import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { PrimaryButton, GhostButton } from '../components/Button.jsx';

const TARGETS = [11, 15, 21];

export default function TournamentSetupScreen() {
  const navigate = useNavigate();
  const [players, setPlayers] = useState([]);
  const [selected, setSelected] = useState([]);
  const [name, setName] = useState('');
  const [target, setTarget] = useState(21);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api('/api/players').then((d) => setPlayers(d.players)).catch(() => {});
  }, []);

  function toggle(id) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  async function start() {
    setSubmitting(true);
    setError(null);
    try {
      const { tournament } = await api('/api/tournaments', {
        method: 'POST',
        body: { name: name || null, playerIds: selected, targetScore: target },
      });
      navigate(`/tournaments/${tournament.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const matches = (selected.length * (selected.length - 1)) / 2;

  return (
    <div className="min-h-screen px-5 py-6 max-w-md mx-auto pb-12">
      <header className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-bold tracking-tight">New tournament</h1>
        <GhostButton onClick={() => navigate('/tournaments')}>Cancel</GhostButton>
      </header>

      <section className="mb-5">
        <p className="text-xs uppercase tracking-wider text-[#FAEEDA]/60 mb-2">Name (optional)</p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Friday night cornhole"
          className="w-full min-h-[44px] px-3 rounded-xl bg-[#082F58] border border-[#FAEEDA]/20 text-[#FAEEDA] outline-none"
        />
      </section>

      <section className="mb-5">
        <p className="text-xs uppercase tracking-wider text-[#FAEEDA]/60 mb-2">
          Players ({selected.length} picked &middot; {matches} matches)
        </p>
        <p className="text-xs text-[#FAEEDA]/60 mb-2">Round-robin, 1v1. Pick 3 to 16 players.</p>
        <div className="flex flex-col gap-2">
          {players.map((p) => {
            const active = selected.includes(p.id);
            return (
              <button
                key={p.id}
                onClick={() => toggle(p.id)}
                className={
                  'p-3 rounded-xl text-left font-medium border ' +
                  (active
                    ? 'bg-[#FAEEDA] text-[#0C447C] border-[#FAEEDA]'
                    : 'bg-[#082F58] text-[#FAEEDA] border-[#FAEEDA]/20')
                }
              >
                {active ? '✓ ' : ''}
                {p.username}
              </button>
            );
          })}
        </div>
      </section>

      <section className="mb-5">
        <p className="text-xs uppercase tracking-wider text-[#FAEEDA]/60 mb-2">Target score</p>
        <div className="flex gap-2">
          {TARGETS.map((t) => (
            <button
              key={t}
              onClick={() => setTarget(t)}
              className={
                'flex-1 min-h-[44px] rounded-xl font-semibold ' +
                (target === t
                  ? 'bg-[#FAEEDA] text-[#0C447C]'
                  : 'bg-[#082F58] text-[#FAEEDA] border border-[#FAEEDA]/20')
              }
            >
              {t}
            </button>
          ))}
        </div>
      </section>

      {error && <p className="text-sm text-[#EF4444] mb-2">{error}</p>}

      <PrimaryButton
        className="w-full"
        disabled={selected.length < 3 || submitting}
        onClick={start}
      >
        {submitting ? 'Creating...' : `Create tournament (${matches} matches)`}
      </PrimaryButton>
    </div>
  );
}
