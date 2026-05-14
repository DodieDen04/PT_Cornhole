import { createContext, useCallback, useContext, useEffect, useState } from 'react';

const InstallContext = createContext(null);

function detectPlatform() {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent || '';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}

function detectStandalone() {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return true;
  if (navigator.standalone === true) return true;
  return false;
}

export function InstallProvider({ children }) {
  const [deferred, setDeferred] = useState(null);
  const [isStandalone, setIsStandalone] = useState(() => detectStandalone());
  const [platform] = useState(() => detectPlatform());

  useEffect(() => {
    function onBeforeInstall(e) {
      e.preventDefault();
      setDeferred(e);
    }
    function onInstalled() {
      setDeferred(null);
      setIsStandalone(true);
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferred) return { outcome: 'unavailable' };
    deferred.prompt();
    const choice = await deferred.userChoice;
    setDeferred(null);
    return choice;
  }, [deferred]);

  return (
    <InstallContext.Provider
      value={{ canPrompt: !!deferred, promptInstall, isStandalone, platform }}
    >
      {children}
    </InstallContext.Provider>
  );
}

export function useInstall() {
  const ctx = useContext(InstallContext);
  if (!ctx) throw new Error('useInstall must be used inside InstallProvider');
  return ctx;
}
