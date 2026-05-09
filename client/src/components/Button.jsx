export function PrimaryButton({ children, className = '', ...props }) {
  return (
    <button
      {...props}
      className={
        'min-h-[48px] px-6 rounded-xl bg-[#FAEEDA] text-[#0C447C] font-semibold text-base shadow-md active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 transition ' +
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
        'min-h-[48px] px-6 rounded-xl bg-[#082F58] text-[#FAEEDA] font-semibold text-base border border-[#FAEEDA]/20 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 transition ' +
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
        'min-h-[44px] px-5 rounded-xl bg-[#7F1D1D]/80 text-[#FAEEDA] font-semibold text-sm active:scale-[0.98] transition ' +
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
        'min-h-[40px] px-4 rounded-lg text-[#FAEEDA]/80 font-medium text-sm hover:text-[#FAEEDA] transition ' +
        className
      }
    >
      {children}
    </button>
  );
}
