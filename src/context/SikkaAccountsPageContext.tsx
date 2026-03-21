'use client';

import { createContext, useContext, useState, ReactNode, useCallback, useMemo, useEffect } from 'react';

export type StatusBar = { message: string; type: 'success' | 'error' | 'warning' | 'info'; key: number };

export interface Session {
  id: string;
  tcode: string;
  title: string;
  path: string;
}

interface SikkaAccountsPageContextType {
  // Session Management
  sessions: Session[];
  activeSessionId: string;
  createSession: (tcode?: string, path?: string) => void;
  switchSession: (id: string) => void;
  closeSession: (id: string) => void;
  
  // Sidebar Management
  isSidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;

  // Footer Management
  isFooterVisible: boolean;
  toggleFooter: () => void;

  // SAP Header Actions
  saveAction: (() => void) | null;
  setSaveAction: (action: (() => void) | null) => void;
  cancelAction: (() => void) | null;
  setCancelAction: (action: (() => void) | null) => void;
  exportAction: ((format: 'excel' | 'pdf' | 'html') => void) | null;
  setExportAction: (action: ((format: 'excel' | 'pdf' | 'html') => void) | null) => void;
  
  // F-Key Registry
  executeAction: (() => void) | null;
  setExecuteAction: (action: (() => void) | null) => void;
  searchHelpAction: (() => void) | null;
  setSearchHelpAction: (action: (() => void) | null) => void;

  // System Feedback
  statusBar: StatusBar | null;
  setStatusBar: (status: Omit<StatusBar, 'key'>) => void;
  
  // Settings
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  fontSize: number;
  setFontSize: (size: number) => void;
  theme: string;
  setTheme: (theme: string) => void;

  // Dirty State (Unsaved Data)
  isDirty: boolean;
  setIsDirty: (isDirty: boolean) => void;

  // Selection Mode (Ctrl + Y)
  isSelectionMode: boolean;
  setIsSelectionMode: (val: boolean) => void;
}

const SikkaAccountsPageContext = createContext<SikkaAccountsPageContextType | undefined>(undefined);

const MAX_SESSIONS = 6;

export function SikkaAccountsPageProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<Session[]>([
    { id: '1', tcode: 'START', title: 'SAP Easy Access', path: '/sikka-accounts/dashboard' }
  ]);
  const [activeSessionId, setActiveSessionId] = useState('1');
  const [isSidebarOpen, setSidebarOpenState] = useState(true);
  const [isFooterVisible, setFooterVisibleState] = useState(true);
  
  const [saveAction, setSaveActionState] = useState<(() => void) | null>(null);
  const [cancelAction, setCancelActionState] = useState<(() => void) | null>(null);
  const [exportAction, setExportActionState] = useState<((format: 'excel' | 'pdf' | 'html') => void) | null>(null);
  const [executeAction, setExecuteActionState] = useState<(() => void) | null>(null);
  const [searchHelpAction, setSearchHelpActionState] = useState<(() => void) | null>(null);

  const [statusBar, setStatusBarState] = useState<StatusBar | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [fontSize, setFontSize] = useState(14);
  const [theme, setTheme] = useState('signature');
  const [isDirty, setIsDirty] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  // Memoized setters to prevent downstream re-renders
  const setSaveAction = useCallback((action: (() => void) | null) => setSaveActionState(() => action), []);
  const setCancelAction = useCallback((action: (() => void) | null) => setCancelActionState(() => action), []);
  const setExportAction = useCallback((action: ((format: 'excel' | 'pdf' | 'html') => void) | null) => setExportActionState(() => action), []);
  const setExecuteAction = useCallback((action: (() => void) | null) => setExecuteActionState(() => action), []);
  const setSearchHelpAction = useCallback((action: (() => void) | null) => setSearchHelpActionState(() => action), []);
  const setSidebarOpen = useCallback((open: boolean) => setSidebarOpenState(open), []);
  const setStatusBar = useCallback((status: Omit<StatusBar, 'key'>) => setStatusBarState({ ...status, key: Date.now() }), []);

  const createSession = useCallback((tcode = 'START', path = '/sikka-accounts/dashboard') => {
    if (sessions.length >= MAX_SESSIONS) {
      setStatusBar({ message: 'Maximum number of sessions (6) reached.', type: 'error' });
      return;
    }
    const newId = String(Date.now());
    setSessions(prev => [...prev, { id: newId, tcode, title: 'New Session', path }]);
    setActiveSessionId(newId);
  }, [sessions.length, setStatusBar]);

  const switchSession = useCallback((id: string) => setActiveSessionId(id), []);

  const closeSession = useCallback((id: string) => {
    setSessions(prev => {
        if (prev.length === 1) return prev;
        const filtered = prev.filter(s => s.id !== id);
        if (activeSessionId === id) setActiveSessionId(filtered[0].id);
        return filtered;
    });
  }, [activeSessionId]);

  const toggleSidebar = useCallback(() => setSidebarOpenState(prev => !prev), []);
  const toggleFooter = useCallback(() => setFooterVisibleState(prev => !prev), []);

  useEffect(() => {
    if (statusBar?.message) {
      const timer = setTimeout(() => setStatusBarState(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [statusBar?.key]);

  const value = useMemo(() => ({
    sessions,
    activeSessionId,
    createSession,
    switchSession,
    closeSession,
    isSidebarOpen,
    setSidebarOpen,
    toggleSidebar,
    isFooterVisible,
    toggleFooter,
    saveAction,
    setSaveAction,
    cancelAction,
    setCancelAction,
    exportAction,
    setExportAction,
    executeAction,
    setExecuteAction,
    searchHelpAction,
    setSearchHelpAction,
    statusBar,
    setStatusBar,
    soundEnabled,
    setSoundEnabled,
    fontSize,
    setFontSize,
    theme,
    setTheme,
    isDirty,
    setIsDirty,
    isSelectionMode,
    setIsSelectionMode,
  }), [
    sessions, activeSessionId, createSession, switchSession, closeSession, 
    isSidebarOpen, setSidebarOpen, toggleSidebar, isFooterVisible, toggleFooter, 
    saveAction, setSaveAction, cancelAction, setCancelAction, exportAction, setExportAction,
    executeAction, setExecuteAction, searchHelpAction, setSearchHelpAction,
    statusBar, setStatusBar, soundEnabled, fontSize, theme, isDirty, isSelectionMode
  ]);

  return (
    <SikkaAccountsPageContext.Provider value={value}>
      {children}
    </SikkaAccountsPageContext.Provider>
  );
}

export function useSikkaAccountsPage() {
  const context = useContext(SikkaAccountsPageContext);
  if (context === undefined) {
    throw new Error('useSikkaAccountsPage must be used within a SikkaAccountsPageProvider');
  }
  return context;
}
