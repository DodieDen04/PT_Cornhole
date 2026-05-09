import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { PrimaryButton, SecondaryButton, GhostButton } from '../components/Button.jsx';
import { BAG_COLOURS, BAG_HEX, BAG_LABEL, getLastTeamColour, rememberTeamColours } from '../constants/colours.js';

const TEAM_SIZES = [
  { label: '1 vs 1', size: 1 },
  { label: '2 vs 2', size: 2 },
];

const TARGETS = [11, 15, 21];

export default function GameSetupScreen() {
  const navigate = useNavigate();
  const { player } = useAuth();
  const [players, setPlayers] = useState([]);
  const [teamSize, setTeamSize] = useState(1);
  const [team1, setTeam1] = useState([]);
  const [team2, setTeam2] = useState([]);
  const [team1Colour, setTeam1Colour] = useState(getLastTeamColour(1) || 'YELLOW');
  const [team2Colour, setTeam2Colour] = useState(getLastTeamColour(2) || 'RED');
  const [target, setTarget] = useState(21);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api('/api/players').then((d) => setPlayers(d.players)).catch(() => {});
  }, []);

  function assignedTo(playerId) {
    if (team1.includes(playerId)) return 1;
    if (team2.includes(playerId)) return 2;
    return null;
  }

  function toggleAssign(playerId, team) {
    setError(null);
    if (assignedTo(playerId) === team) {
      if (team === 1) setTeam1((t) => t.filter((id) => id !== playerId));
      else setTeam2((t) => t.filter((id) => id !== playerId));
      return;
    }
    if (team === 1) {
      if (team1.length >= teamSize) return;
      setTeam2((t) => t.filter((id) => id !== playerId));
      setTeam1((t) => [...t, playerId]);
    } else {
      if (team2.length >= teamSize) return;
      setTeam1((t) => t.filter((id) => id !== playerId));
      setTeam2((t) => [...t, playerId]);
    }
  }

  function ready() {
    if (team1.length !== teamSize || team2.length !== teamSize) return false;
    if (team1Colour === team2Colour) return false;
    return true;
  }

  function positionFor(playerId) {
    const i1 = team1.indexOf(playerId);
    if (i1 !== -1) return i1 + 1;
    const i2 = team2.indexOf(playerId);
    if (i2 !== -1) return i2 + 1;
    return null;
  }

  async function startGame() {
    setSubmitting(true);
    setError(null);
    try {
      const body = {
        mode: 'COMPETITIVE',
        team1Colour,
        team2Colour,
        targetScore: target,
        players: [
          ...team1.map((id, i) => ({ playerId: id, team: 1, position: i + 1 })),
          ...team2.map((id, i) => ({ playerId: id, team: 2, position: i + 1 })),
        ],
      };
      const { game } = await api('/api/games', { method: 'POST', body });
      rememberTeamColours(team1Colour, team2Colour);
      navigate(`/game/${game.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function changeTeamSize(s) {
    setTeamSize(s);
    setTeam1([]);
    setTeam2([]);
  }

  return (
    <div className="min-h-screen px-5 py-6 max-w-md mx-auto">
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-tight">New game</h1>
        <GhostButton onClick={() => navigate('/')}>Cancel</GhostButton>
      </header>

      <section className="mb-6">
        <h2 className="text-sm uppercase tracking-wider text-[#FAEEDA]/60 mb-2">Format</h2>
        <div className="flex gap-2">
          {TEAM_SIZES.map((t) => (
            <button
              key={t.size}
              onClick={() => changeTeamSize(t.size)}
              className={
                'flex-1 min-h-[44px] rounded-xl font-semibold transition ' +
                (teamSize === t.size
                  ? 'bg-[#FAEEDA] text-[#0C447C]'
                  : 'bg-[#082F58] text-[#FAEEDA] border border-[#FAEEDA]/20')
              }
            >
              {t.label}
            </button>
          ))}
        </div>
      </section>

      <section className="mb-6">
        <h2 className="text-sm uppercase tracking-wider text-[#FAEEDA]/60 mb-2">Players</h2>
        <p className="text-xs text-[#FAEEDA]/60 mb-3">
          Tap a player, then tap Team 1 or Team 2.
          {teamSize === 2 && ' First player on each team throws from end A; second from end B.'}
        </p>
        <div className="flex flex-col gap-2">
          {players.map((p) => {
            const team = assignedTo(p.id);
            const position = positionFor(p.id);
            return (
              <div
                key={p.id}
                className="flex items-center gap-2 p-3 rounded-xl bg-[#082F58] border border-[#FAEEDA]/20"
              >
                <span className="flex-1 font-medium">
                  {p.username}
                  {p.id === player.id && (
                    <span className="ml-2 text-xs text-[#FAEEDA]/60">(you)</span>
                  )}
                  {teamSize === 2 && team && position && (
                    <span className="ml-2 text-xs text-[#FAEEDA]/70">
                      End {position === 1 ? 'A' : 'B'}
                    </span>
                  )}
                </span>
                <button
                  onClick={() => toggleAssign(p.id, 1)}
                  className={
                    'min-h-[36px] px-3 rounded-lg text-sm font-semibold ' +
                    (team === 1
                      ? 'bg-[#FAEEDA] text-[#0C447C]'
                      : 'bg-[#0C447C] text-[#FAEEDA] border border-[#FAEEDA]/20')
                  }
                >
                  T1
                </button>
                <button
                  onClick={() => toggleAssign(p.id, 2)}
                  className={
                    'min-h-[36px] px-3 rounded-lg text-sm font-semibold ' +
                    (team === 2
                      ? 'bg-[#FAEEDA] text-[#0C447C]'
                      : 'bg-[#0C447C] text-[#FAEEDA] border border-[#FAEEDA]/20')
                  }
                >
                  T2
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mb-6">
        <h2 className="text-sm uppercase tracking-wider text-[#FAEEDA]/60 mb-2">Bag colours</h2>
        <ColourRow
          label="Team 1"
          value={team1Colour}
          disabled={team2Colour}
          onChange={setTeam1Colour}
        />
        <ColourRow
          label="Team 2"
          value={team2Colour}
          disabled={team1Colour}
          onChange={setTeam2Colour}
        />
      </section>

      <section className="mb-6">
        <h2 className="text-sm uppercase tracking-wider text-[#FAEEDA]/60 mb-2">Target score</h2>
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

      {error && <p className="text-sm text-[#EF4444] mb-3">{error}</p>}

      <PrimaryButton className="w-full" disabled={!ready() || submitting} onClick={startGame}>
        {submitting ? 'Starting...' : 'Start game'}
      </PrimaryButton>
    </div>
  );
}

function ColourRow({ label, value, disabled, onChange }) {
  return (
    <div className="mb-2">
      <p className="text-xs text-[#FAEEDA]/70 mb-1">{label}</p>
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
                (isSelected
                  ? 'border-[#FAEEDA]'
                  : 'border-transparent') +
                (isDisabled ? ' opacity-30' : '')
              }
              style={{ background: BAG_HEX[c] }}
              aria-label={BAG_LABEL[c]}
            >
              {isSelected && <span className="text-[#0C447C] font-bold">✓</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
