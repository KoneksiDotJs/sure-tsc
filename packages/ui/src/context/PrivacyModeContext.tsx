import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

interface PrivacyModeContextValue {
  enabled: boolean;
  toggle: () => void;
  setEnabled: (value: boolean) => void;
}

const PrivacyModeContext = createContext<PrivacyModeContextValue>({
  enabled: false,
  toggle: () => undefined,
  setEnabled: () => undefined,
});

const STORAGE_KEY = 'sure:privacy-mode';

export const PrivacyModeProvider: React.FC<{
  children: React.ReactNode;
  defaultEnabled?: boolean;
}> = ({ children, defaultEnabled = false }) => {
  const [enabled, setEnabledState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return defaultEnabled;
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      return saved !== null ? saved === 'true' : defaultEnabled;
    } catch {
      return defaultEnabled;
    }
  });

  const setEnabled = useCallback((value: boolean) => {
    setEnabledState(value);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(STORAGE_KEY, String(value));
      } catch {
        // Ignore storage write errors
      }
    }
  }, []);

  const toggle = useCallback(() => {
    setEnabledState((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(STORAGE_KEY, String(next));
        } catch {
          // Ignore
        }
      }
      return next;
    });
  }, []);

  // Bind global html.privacy-mode class matching Sure's privacy-mode.css
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.classList.toggle('privacy-mode', enabled);
  }, [enabled]);

  // Global Shortcut: Shift + P toggles Privacy Mode (DESIGN-SYSTEM.md Section 6)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if (!isInput && event.shiftKey && event.key.toUpperCase() === 'P' && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        toggle();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggle]);

  return (
    <PrivacyModeContext.Provider value={{ enabled, toggle, setEnabled }}>
      {children}
    </PrivacyModeContext.Provider>
  );
};

export function usePrivacyMode(): PrivacyModeContextValue {
  return useContext(PrivacyModeContext);
}
