import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { PrimaryButton } from '../components/Button.jsx';
import Breadcrumb from '../components/Breadcrumb.jsx';

export default function GroupsListScreen() {
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api('/api/groups')
      .then((d) => setGroups(d.groups))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen px-5 py-6 max-w-md mx-auto pb-12">
      <header className="mb-5">
        <Breadcrumb
          crumbs={[
            { label: 'Home', path: '/' },
            { label: 'Settings', path: '/settings' },
            { label: 'My groups' },
          ]}
        />
        <h1 className="text-2xl font-bold tracking-tight">My groups</h1>
      </header>

      {error && (
        <p className="mb-3 p-2 rounded-lg bg-[#EF4444]/15 text-[#EF4444] text-sm">{error}</p>
      )}

      <PrimaryButton className="w-full mb-4" onClick={() => navigate('/groups/new')}>
        Create group
      </PrimaryButton>

      {loading ? (
        <p className="text-sm text-ink/70">Loading...</p>
      ) : groups.length === 0 ? (
        <p className="text-sm text-ink/70">You're not in any groups yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {groups.map((g) => (
            <li
              key={g.id}
              onClick={() => navigate(`/groups/${g.id}`)}
              className="p-3 rounded-2xl bg-surface border border-ink/15 cursor-pointer hover:border-ink/40 flex items-center gap-2"
            >
              <div className="flex-1">
                <p className="font-semibold">{g.name}</p>
                <p className="text-xs text-ink/70 mt-0.5">
                  {g.memberCount ?? 0} member{(g.memberCount ?? 0) === 1 ? '' : 's'}
                </p>
              </div>
              {g.isAdmin && (
                <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#FFD700]/15 text-[#FFD700] border border-[#FFD700]/30">
                  Admin
                </span>
              )}
              <span className="text-ink/40 ml-1">›</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
