import { useEffect, useState } from 'react';

const DISMISSED_KEY = 'pt_cornhole_install_dismissed';

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function onBeforeInstall(e) {
      e.preventDefault();
      if (localStorage.getItem(DISMISSED_KEY)) return;
      setDeferred(e);
      setVisible(true);
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall);
  }, []);

  function dismiss() {
    setVisible(false);
    localStorage.setItem(DISMISSED_KEY, '1');
  }

  async function install() {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice;
    setVisible(false);
    setDeferred(null);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-3 inset-x-3 z-40 max-w-md mx-auto p-3 rounded-2xl bg-[#082F58] border border-[#FAEEDA]/30 shadow-lg flex items-center gap-3">
      <div className="flex-1">
        <p className="text-sm font-semibold">Install PT Cornhole</p>
        <p className="text-xs text-[#FAEEDA]/70">Add to home screen for full-screen play.</p>
      </div>
      <button
        onClick={dismiss}
        className="min-h-[36px] px-3 rounded-lg text-sm text-[#FAEEDA]/70"
      >
        Not now
      </button>
      <button
        onClick={install}
        className="min-h-[36px] px-3 rounded-lg text-sm font-semibold bg-[#FAEEDA] text-[#0C447C]"
      >
        Install
      </button>
    </div>
  );
}
