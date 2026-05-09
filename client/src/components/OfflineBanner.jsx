import { useEffect, useState } from 'react';
import { flushQueue } from '../api.js';
import { queueLength } from '../lib/syncQueue.js';

export default function OfflineBanner() {
  const [online, setOnline] = useState(navigator.onLine);
  const [pending, setPending] = useState(0);
  const [flushing, setFlushing] = useState(false);

  async function refreshPending() {
    try {
      setPending(await queueLength());
    } catch {}
  }

  useEffect(() => {
    refreshPending();
    function handleOnline() {
      setOnline(true);
      doFlush();
    }
    function handleOffline() {
      setOnline(false);
    }
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    const interval = setInterval(refreshPending, 4000);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  async function doFlush() {
    if (flushing) return;
    setFlushing(true);
    try {
      await flushQueue();
      await refreshPending();
    } finally {
      setFlushing(false);
    }
  }

  if (online && pending === 0) return null;

  return (
    <div className="fixed top-2 inset-x-2 z-40 max-w-md mx-auto px-3 py-2 rounded-xl bg-[#7F1D1D]/85 border border-[#FAEEDA]/30 text-[#FAEEDA] text-xs flex items-center gap-2">
      <span
        className="w-2 h-2 rounded-full"
        style={{ background: online ? '#FBBF24' : '#EF4444' }}
      />
      <span className="flex-1">
        {online ? 'Back online' : 'Offline'}
        {pending > 0 ? ` · ${pending} action${pending === 1 ? '' : 's'} pending` : ''}
      </span>
      {online && pending > 0 && (
        <button onClick={doFlush} className="font-semibold underline">
          {flushing ? 'Syncing...' : 'Sync'}
        </button>
      )}
    </div>
  );
}
