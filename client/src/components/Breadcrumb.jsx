import { useNavigate } from 'react-router-dom';

export default function Breadcrumb({ crumbs }) {
  const navigate = useNavigate();
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-1.5 text-xs text-ink/70 mb-2 flex-wrap"
    >
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1;
        return (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-ink/40" aria-hidden="true">/</span>}
            {isLast || !crumb.path ? (
              <span className="font-semibold text-ink" aria-current="page">
                {crumb.label}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => navigate(crumb.path)}
                className="underline underline-offset-2 hover:text-ink py-1"
              >
                {crumb.label}
              </button>
            )}
          </span>
        );
      })}
    </nav>
  );
}
