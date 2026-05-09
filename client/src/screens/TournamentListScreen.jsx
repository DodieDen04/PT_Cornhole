import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { PrimaryButton, GhostButton } from '../components/Button.jsx';

export default function TournamentListScreen() {
  const navigate = useNavigate();
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/api/tournaments')
      .then((d) => setTournaments(d.tournaments))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen px-5 py-6 max-w-md mx-auto pb-12">
      <header className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-bold tracking-tight">Tournaments</h1>
        <GhostButton onClick={() => navigate('/')}>Home</GhostButton>
      </header>

      <PrimaryButton className="w-full mb-4" onClick={() => navigate('/tournaments/new')}>
        New tournament
      </PrimaryButton>

      {loading ? (
        <p className="text-[#FAEEDA]/70 text-sm">Loading...</p>
      ) : tournaments.length === 0 ? (
        <p className="text-[#FAEEDA]/70 text-sm">No tournaments yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {tournaments.map((t) => (
            <li
              key={t.id}
              onClick={() => navigate(`/tournaments/${t.id}`)}
              className="p-3 rounded-2xl bg-[#082F58] border border-[#FAEEDA]/15 cursor-pointer hover:border-[#FAEEDA]/40"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-[#FAEEDA]/60">
                  {new Date(t.createdAt).toLocaleString()}
                </span>
                <span
                  className={
                    'text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ' +
                    (t.status === 'COMPLETED'
                      ? 'bg-[#22C55E]/20 text-[#22C55E]'
                      : 'bg-[#FAEEDA]/20 text-[#FAEEDA]')
                  }
                >
                  {t.status === 'COMPLETED' ? 'Completed' : 'Live'}
                </span>
              </div>
              <p className="font-medium">{t.name || 'Tournament'}</p>
              <p className="text-xs text-[#FAEEDA]/70">
                {t.participants.map((p) => p.player.username).join(', ')} &middot;{' '}
                {t._count.matches} matches
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
