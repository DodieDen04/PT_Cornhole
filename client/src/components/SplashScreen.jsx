import { useEffect, useState } from 'react';
import SplashArt from '../SplashArt.jsx';

const VERSION = 'v0.1';
const MIN_VISIBLE_MS = 1200;
const FADE_MS = 250;

export default function SplashScreen({ ready, onComplete }) {
  const [minTimePassed, setMinTimePassed] = useState(false);
  const [fadingOut, setFadingOut] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMinTimePassed(true), MIN_VISIBLE_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!fadingOut) return;
    const t = setTimeout(() => {
      setHidden(true);
      onComplete && onComplete();
    }, FADE_MS);
    return () => clearTimeout(t);
  }, [fadingOut, onComplete]);

  useEffect(() => {
    if (ready && minTimePassed) setFadingOut(true);
  }, [ready, minTimePassed]);

  useEffect(() => {
    const safety = setTimeout(() => setFadingOut(true), 5000);
    return () => clearTimeout(safety);
  }, []);

  if (hidden) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0C447C] transition-opacity"
      style={{
        opacity: fadingOut ? 0 : 1,
        transitionDuration: `${FADE_MS}ms`,
        paddingBottom: 'env(safe-area-inset-bottom)',
        pointerEvents: fadingOut ? 'none' : 'auto',
      }}
    >
      <SplashArt className="w-64 max-w-[60vw]" />
      <p className="mt-8 text-[13px] font-medium tracking-[0.2em] text-[#FAEEDA] uppercase">
        PT for your cornhole
      </p>
      <div className="mt-6 flex gap-2">
        <span
          className="splash-dot w-2 h-2 rounded-full bg-[#FAEEDA]"
          style={{ animationDelay: '0s' }}
        />
        <span
          className="splash-dot w-2 h-2 rounded-full bg-[#FAEEDA]"
          style={{ animationDelay: '0.2s' }}
        />
        <span
          className="splash-dot w-2 h-2 rounded-full bg-[#FAEEDA]"
          style={{ animationDelay: '0.4s' }}
        />
      </div>
      <span className="absolute bottom-6 text-[9px] tracking-wider text-[#FAEEDA]/40">
        {VERSION}
      </span>
    </div>
  );
}
