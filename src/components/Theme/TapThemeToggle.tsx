'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';

const THEME_KEY = 'sap_theme';

export default function TapThemeToggle() {
  const pathname = usePathname();

  const [mounted, setMounted] = React.useState(false);
  const [theme, setTheme] = React.useState<'light' | 'dark'>('light');

  React.useEffect(() => {
    setMounted(true);
    const saved = (localStorage.getItem(THEME_KEY) || 'light') as 'light' | 'dark';
    setTheme(saved);
    document.documentElement.setAttribute('data-theme', saved);
  }, []);

  const toggle = React.useCallback(() => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem(THEME_KEY, next);
  }, [theme]);

  // Hide toggle on print
  if (pathname?.includes('/print/')) return null;
  if (!mounted) return null;

  return (
    <button
      type="button"
      aria-label="Toggle theme"
      onClick={toggle}
      className="h-7 px-2 rounded-none text-[10px] font-black uppercase tracking-widest bg-accent text-accent-foreground hover:opacity-90 transition-opacity print:hidden"
    >
      {theme === 'dark' ? 'LIGHT' : 'DARK'}
    </button>
  );
}

