export function PrimaryButton({ children, className = '', ...props }) {
  return (
    <button
      {...props}
      className={
        'min-h-[48px] px-6 rounded-xl bg-ink text-page font-semibold text-base shadow-md active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 transition ' +
        className
      }
    >
      {children}
    </button>
  );
}

export function SecondaryButton({ children, className = '', ...props }) {
  return (
    <button
      {...props}
      className={
        'min-h-[48px] px-6 rounded-xl bg-surface text-ink font-semibold text-base border border-ink/20 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 transition ' +
        className
      }
    >
      {children}
    </button>
  );
}

export function DangerButton({ children, className = '', ...props }) {
  return (
    <button
      {...props}
      className={
        'min-h-[44px] px-5 rounded-xl bg-[#7F1D1D]/80 text-ink font-semibold text-sm active:scale-[0.98] transition ' +
        className
      }
    >
      {children}
    </button>
  );
}

export function GhostButton({ children, className = '', ...props }) {
  return (
    <button
      {...props}
      className={
        'min-h-[40px] px-4 rounded-lg text-ink/80 font-medium text-sm hover:text-ink transition ' +
        className
      }
    >
      {children}
    </button>
  );
}
