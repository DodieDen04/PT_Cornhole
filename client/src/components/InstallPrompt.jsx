import { useState } from 'react';
import { useInstall } from '../contexts/InstallContext.jsx';

const DISMISSED_KEY = 'pt_cornhole_install_dismissed';

export default function InstallPrompt() {
  const { canPrompt, promptInstall, isStandalone } = useInstall();
  const [dismissed, setDismissed] = useState(() => !!localStorage.getItem(DISMISSED_KEY));

  if (isStandalone || dismissed || !canPrompt) return null;

  function dismiss() {
    setDismissed(true);
    localStorage.setItem(DISMISSED_KEY, '1');
  }

  async function install() {
    await promptInstall();
  }

  return (
    <div className="fixed bottom-3 inset-x-3 z-40 max-w-md mx-auto p-3 rounded-2xl bg-surface border border-ink/30 shadow-lg flex items-center gap-3">
      <div className="flex-1">
        <p className="text-sm font-semibold">Install PT Cornhole</p>
        <p className="text-xs text-ink/70">Add to home screen for full-screen play.</p>
      </div>
      <button
        onClick={dismiss}
        className="min-h-[36px] px-3 rounded-lg text-sm text-ink/70"
      >
        Not now
      </button>
      <button
        onClick={install}
        className="min-h-[36px] px-3 rounded-lg text-sm font-semibold bg-ink text-page"
      >
        Install
      </button>
    </div>
  );
}
