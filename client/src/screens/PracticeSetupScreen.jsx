import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { PrimaryButton, GhostButton } from '../components/Button.jsx';
import { BAG_COLOURS, BAG_HEX, BAG_LABEL, getLastPlayerColour, rememberPlayerColour } from '../constants/colours.js';

export default function PracticeSetupScreen() {
  const navigate = useNavigate();
  const { player } = useAuth();
  const [players, setPlayers] = useState([]);
  const [partnerId, setPartnerId] = useState(null);
  const [throwsPerSet, setThrowsPerSet] = useState(4);
  const [tag, setTag] = useState('');
  const [colours, setColours] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api('/api/players').then((d) => {
      setPlayers(d.players);
      setColours((c) => ({
        ...c,
        [player.id]: getLastPlayerColour(player.id) || 'YELLOW',
      }));
    }).catch(() => {});
  }, [player.id]);

  function setColour(pid, colour) {
    setColours((c) => ({ ...c, [pid]: colour }));
  }

  function togglePartner(pid) {
    if (partnerId === pid) {
      setPartnerId(null);
      setColours((c) => {
        const next = { ...c };
        delete next[pid];
        return next;
      });
    } else {
      setPartnerId(pid);
      setColours((c) => ({
        ...c,
        [pid]: getLastPlayerColour(pid) || (c[player.id] === 'RED' ? 'BLUE' : 'RED'),
      }));
    }
  }

  function ready() {
    if (!colours[player.id]) return false;
    if (partnerId) {
      if (!colours[partnerId]) return false;
      if (colours[partnerId] === colours[player.id]) return false;
    }
    return true;
  }

  async function start() {
    setSubmitting(true);
    setError(null);
    try {
      const sessionPlayers = [{ playerId: player.id, bagColour: colours[player.id] }];
      if (partnerId) sessionPlayers.push({ playerId: partnerId, bagColour: colours[partnerId] });
      const body = {
        mode: 'PRACTICE',
        players: sessionPlayers,
        practiceThrowsPerSet: throwsPerSet,
        tag: tag.trim() || null,
      };
      const { game } = await api('/api/games', { method: 'POST', body });
      sessionPlayers.forEach((p) => rememberPlayerColour(p.playerId, p.bagColour));
      navigate(`/practice/${game.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen px-5 py-6 max-w-md mx-auto">
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Practice</h1>
        <GhostButton onClick={() => navigate('/')}>Cancel</GhostButton>
      </header>

      <section className="mb-6">
        <h2 className="text-sm uppercase tracking-wider text-ink/60 mb-2">You</h2>
        <ColourRow
          value={colours[player.id]}
          disabled={partnerId ? colours[partnerId] : null}
          onChange={(c) => setColour(player.id, c)}
        />
      </section>

      <section className="mb-6">
        <h2 className="text-sm uppercase tracking-wider text-ink/60 mb-2">
          Practice partner (optional)
        </h2>
        <div className="flex flex-col gap-2">
          {players.filter((p) => p.id !== player.id).map((p) => (
            <button
              key={p.id}
              onClick={() => togglePartner(p.id)}
              className={
                'p-3 rounded-xl text-left font-medium border ' +
                (partnerId === p.id
                  ? 'bg-ink text-page border-ink'
                  : 'bg-surface text-ink border-ink/20')
              }
            >
              {p.username}
            </button>
          ))}
        </div>
        {partnerId && (
          <div className="mt-3">
            <p className="text-xs text-ink/70 mb-1">Partner colour</p>
            <ColourRow
              value={colours[partnerId]}
              disabled={colours[player.id]}
              onChange={(c) => setColour(partnerId, c)}
            />
          </div>
        )}
      </section>

      <section className="mb-6">
        <h2 className="text-sm uppercase tracking-wider text-ink/60 mb-2">Throws per set</h2>
        <div className="flex gap-2">
          {[4, 8].map((n) => (
            <button
              key={n}
              onClick={() => setThrowsPerSet(n)}
              className={
                'flex-1 min-h-[44px] rounded-xl font-semibold ' +
                (throwsPerSet === n
                  ? 'bg-ink text-page'
                  : 'bg-surface text-ink border border-ink/20')
              }
            >
              {n}
            </button>
          ))}
        </div>
      </section>

      <section className="mb-6">
        <h2 className="text-sm uppercase tracking-wider text-ink/60 mb-2">
          Session tag (optional)
        </h2>
        <input
          type="text"
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          placeholder="e.g. left hand, 15ft"
          className="w-full min-h-[44px] px-4 rounded-xl bg-surface border border-ink/20 text-ink outline-none focus:border-ink/60"
        />
      </section>

      {error && <p className="text-sm text-[#EF4444] mb-3">{error}</p>}

      <PrimaryButton className="w-full" disabled={!ready() || submitting} onClick={start}>
        {submitting ? 'Starting...' : 'Start practice'}
      </PrimaryButton>
    </div>
  );
}

function ColourRow({ value, disabled, onChange }) {
  return (
    <div className="flex gap-2">
      {BAG_COLOURS.map((c) => {
        const isSelected = value === c;
        const isDisabled = c === disabled;
        return (
          <button
            key={c}
            onClick={() => onChange(c)}
            disabled={isDisabled}
            className={
              'flex-1 min-h-[44px] rounded-xl border-2 flex items-center justify-center ' +
              (isSelected ? 'border-ink' : 'border-transparent') +
              (isDisabled ? ' opacity-30' : '')
            }
            style={{ background: BAG_HEX[c] }}
            aria-label={BAG_LABEL[c]}
          >
            {isSelected && <span className="text-page font-bold">✓</span>}
          </button>
        );
      })}
    </div>
  );
}
