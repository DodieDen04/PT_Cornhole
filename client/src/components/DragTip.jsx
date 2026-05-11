import { useEffect, useState } from 'react';

const KEY = 'pt_cornhole_drag_tip_dismissed';

export default function DragTip() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setShow(true);
    } catch {}
  }, []);

  function dismiss() {
    setShow(false);
    try {
      localStorage.setItem(KEY, '1');
    } catch {}
  }

  if (!show) return null;

  return (
    <button
      onClick={dismiss}
      className="w-full mb-2 px-3 py-2 rounded-xl bg-[#FFD700]/15 border border-[#FFD700]/40 text-[#FAEEDA] text-xs flex items-center gap-2 active:opacity-80"
    >
      <span aria-hidden>👆</span>
      <span className="flex-1 text-left">
        Tip: touch and drag any bag to move it (if a later throw knocks it).
      </span>
      <span className="text-[#FAEEDA]/60">✕</span>
    </button>
  );
}
