import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { PrimaryButton, GhostButton } from '../components/Button.jsx';
import ThrowOrderModal from '../components/ThrowOrderModal.jsx';
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
  const [team1, setTeam1] = useState(() => (player ? [player.id] : []));
  const [team2, setTeam2] = useState([]);
  const [team1Colour, setTeam1Colour] = useState(getLastTeamColour(1) || 'YELLOW');
  const [team2Colour, setTeam2Colour] = useState(getLastTeamColour(2) || 'RED');
  const [target, setTarget] = useState(21);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [creatingGuest, setCreatingGuest] = useState(false);
  const [groups, setGroups] = useState([]);
  const [activeGroupId, setActiveGroupId] = useState(null);
  const [groupMembersCache, setGroupMembersCache] = useState({});
  const [showOrderModal, setShowOrderModal] = useState(false);

  useEffect(() => {
    api('/api/players').then((d) => setPlayers(d.players)).catch(() => {});
  }, []);

  useEffect(() => {
    api('/api/groups').then((d) => setGroups(d.groups)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!activeGroupId || groupMembersCache[activeGroupId]) return;
    api(`/api/groups/${activeGroupId}`)
      .then((d) => {
        const ids = new Set(
          (d.group.members || [])
            .filter((m) => m.status === 'MEMBER')
            .map((m) => m.playerId),
        );
        setGroupMembersCache((c) => ({ ...c, [activeGroupId]: ids }));
      })
      .catch(() => {});
  }, [activeGroupId, groupMembersCache]);

  const otherPlayers = useMemo(
    () => players.filter((p) => p.id !== player.id),
    [players, player.id],
  );
  const activeGroupMemberIds =
    activeGroupId ? groupMembersCache[activeGroupId] : null;
  const eligibleOthers = useMemo(() => {
    if (!activeGroupMemberIds) return otherPlayers;
    return otherPlayers.filter((p) => activeGroupMemberIds.has(p.id));
  }, [otherPlayers, activeGroupMemberIds]);
  const team1Hex = BAG_HEX[team1Colour];
  const team2Hex = BAG_HEX[team2Colour];

  function toggleT1(playerId) {
    setError(null);
    if (team1.includes(playerId)) {
      setTeam1((t) => t.filter((id) => id !== playerId));
      return;
    }
    if (teamSize === 1) {
      // 1v1: only one slot, replace
      setTeam2((t) => t.filter((id) => id !== playerId));
      setTeam1([playerId]);
      return;
    }
    if (team1.length >= teamSize) return;
    setTeam2((t) => t.filter((id) => id !== playerId));
    setTeam1((t) => [...t, playerId]);
  }

  function toggleT2(playerId) {
    setError(null);
    if (team2.includes(playerId)) {
      setTeam2((t) => t.filter((id) => id !== playerId));
      return;
    }
    if (teamSize === 1) {
      // 1v1: only one opponent slot, replace
      setTeam1((t) => t.filter((id) => id !== playerId));
      setTeam2([playerId]);
      return;
    }
    if (team2.length >= teamSize) return;
    setTeam1((t) => t.filter((id) => id !== playerId));
    setTeam2((t) => [...t, playerId]);
  }

  function ready() {
    if (team1.length !== teamSize || team2.length !== teamSize) return false;
    if (team1Colour === team2Colour) return false;
    return true;
  }

  async function startGame({ startingTeam, team1Order, team2Order }) {
    setSubmitting(true);
    setError(null);
    try {
      const body = {
        mode: 'COMPETITIVE',
        team1Colour,
        team2Colour,
        targetScore: target,
        startingTeam,
        groupId: activeGroupId,
        players: [
          ...team1Order.map((id, i) => ({ playerId: id, team: 1, position: i + 1 })),
          ...team2Order.map((id, i) => ({ playerId: id, team: 2, position: i + 1 })),
        ],
      };
      const { game } = await api('/api/games', { method: 'POST', body });
      rememberTeamColours(team1Colour, team2Colour);
      navigate(`/game/${game.id}`);
    } catch (err) {
      setError(err.message);
      setShowOrderModal(false);
    } finally {
      setSubmitting(false);
    }
  }

  function changeTeamSize(s) {
    setTeamSize(s);
    setTeam1([player.id]);
    setTeam2([]);
  }

  async function createGuest() {
    const name = guestName.trim();
    if (!name) {
      setError('Display name required');
      return;
    }
    setCreatingGuest(true);
    setError(null);
    try {
      const { player: guest } = await api('/api/players/guest', {
        method: 'POST',
        body: { displayName: name },
      });
      setPlayers((ps) => [...ps, guest].sort((a, b) => a.username.localeCompare(b.username)));
      // Auto-select the new guest as opponent
      toggleT2(guest.id);
      setGuestName('');
      setShowQuickAdd(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setCreatingGuest(false);
    }
  }

  const team1Candidates = useMemo(
    () => [player, ...eligibleOthers].filter((p) => !team2.includes(p.id)),
    [player, eligibleOthers, team2],
  );
  const team2Candidates = useMemo(
    () => [player, ...eligibleOthers].filter((p) => !team1.includes(p.id)),
    [player, eligibleOthers, team1],
  );
  const playersById = useMemo(() => {
    const map = {};
    for (const p of players) map[p.id] = p;
    if (player && !map[player.id]) map[player.id] = player;
    return map;
  }, [players, player]);

  return (
    <div className="min-h-screen px-5 py-6 max-w-md mx-auto">
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-tight">New game</h1>
        <GhostButton onClick={() => navigate('/')}>Cancel</GhostButton>
      </header>

      <section className="mb-6">
        <h2 className="text-sm uppercase tracking-wider text-ink/60 mb-2">Format</h2>
        <div className="flex gap-2">
          {TEAM_SIZES.map((t) => (
            <button
              key={t.size}
              onClick={() => changeTeamSize(t.size)}
              className={
                'flex-1 min-h-[44px] rounded-xl font-semibold transition ' +
                (teamSize === t.size
                  ? 'bg-ink text-page'
                  : 'bg-surface text-ink border border-ink/20')
              }
            >
              {t.label}
            </button>
          ))}
        </div>
      </section>

      {groups.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm uppercase tracking-wider text-ink/60 mb-2">Group</h2>
          <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
            <GroupChip
              label="All"
              active={activeGroupId === null}
              onClick={() => setActiveGroupId(null)}
            />
            {groups.map((g) => (
              <GroupChip
                key={g.id}
                label={g.name}
                active={activeGroupId === g.id}
                onClick={() => setActiveGroupId(g.id)}
              />
            ))}
          </div>
          {activeGroupId && (
            <p className="text-xs text-ink/60 mt-1">
              Showing only members of this group.
            </p>
          )}
        </section>
      )}

      <section className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm uppercase tracking-wider text-ink/60">Team 1</h2>
          <ColourSelect value={team1Colour} taken={team2Colour} onChange={setTeam1Colour} />
        </div>
        <p className="text-xs text-ink/60 mb-2">
          You're in by default. Tap yourself to step out and referee instead.
        </p>
        <div className="flex flex-col gap-2">
          {team1Candidates.map((p) => (
            <PlayerCard
              key={p.id}
              label={p.id === player.id ? `${p.username} (you)` : p.username}
              isGuest={p.isGuest}
              selected={team1.includes(p.id)}
              teamColour={team1.includes(p.id) ? team1Hex : null}
              onClick={() => toggleT1(p.id)}
            />
          ))}
        </div>
      </section>

      <section className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm uppercase tracking-wider text-ink/60">Team 2</h2>
          <ColourSelect value={team2Colour} taken={team1Colour} onChange={setTeam2Colour} />
        </div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-ink/60">
            {teamSize === 1 ? 'Tap a player to choose the opponent.' : 'Pick two players.'}
          </p>
          <button
            onClick={() => setShowQuickAdd((s) => !s)}
            className="text-xs font-semibold text-ink underline underline-offset-4 shrink-0"
          >
            {showQuickAdd ? 'Cancel' : '+ Add guest'}
          </button>
        </div>

        {showQuickAdd && (
          <div className="mb-3 p-3 rounded-xl bg-surface border border-ink/30">
            <p className="text-xs text-ink/70 mb-2">
              Quick add a non-registered player. They can play and accumulate stats.
            </p>
            <div className="flex gap-2">
              <input
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Display name"
                maxLength={30}
                className="flex-1 min-h-[40px] px-3 rounded-lg bg-surface-2 border border-ink/20 text-ink outline-none text-sm"
              />
              <button
                onClick={createGuest}
                disabled={creatingGuest || !guestName.trim()}
                className="min-h-[40px] px-3 rounded-lg bg-ink text-page font-semibold text-sm disabled:opacity-50"
              >
                {creatingGuest ? '...' : 'Create'}
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {team2Candidates.length === 0 ? (
            <p className="text-xs text-ink/50 italic">No other players available.</p>
          ) : (
            team2Candidates.map((p) => (
              <PlayerCard
                key={p.id}
                label={p.id === player.id ? `${p.username} (you)` : p.username}
                isGuest={p.isGuest}
                selected={team2.includes(p.id)}
                teamColour={team2.includes(p.id) ? team2Hex : null}
                onClick={() => toggleT2(p.id)}
              />
            ))
          )}
        </div>
      </section>

      <section className="mb-6">
        <h2 className="text-sm uppercase tracking-wider text-ink/60 mb-2">Target score</h2>
        <div className="flex gap-2">
          {TARGETS.map((t) => (
            <button
              key={t}
              onClick={() => setTarget(t)}
              className={
                'flex-1 min-h-[44px] rounded-xl font-semibold ' +
                (target === t
                  ? 'bg-ink text-page'
                  : 'bg-surface text-ink border border-ink/20')
              }
            >
              {t}
            </button>
          ))}
        </div>
      </section>

      {error && <p className="text-sm text-[#EF4444] mb-3">{error}</p>}

      <PrimaryButton
        className="w-full"
        disabled={!ready() || submitting}
        onClick={() => setShowOrderModal(true)}
      >
        {submitting ? 'Starting...' : 'Start game'}
      </PrimaryButton>

      {showOrderModal && (
        <ThrowOrderModal
          is2v2={teamSize === 2}
          team1Ids={team1}
          team2Ids={team2}
          team1Hex={team1Hex}
          team2Hex={team2Hex}
          playersById={playersById}
          onCancel={() => setShowOrderModal(false)}
          onConfirm={startGame}
        />
      )}
    </div>
  );
}

function PlayerCard({ label, selected, teamColour, isGuest, onClick }) {
  const baseClasses = 'w-full px-3 py-3 rounded-xl flex items-center gap-2 text-left transition';
  const guestBadge = isGuest ? <GuestBadge selected={selected} /> : null;

  return (
    <button
      onClick={onClick}
      className={
        baseClasses +
        (selected
          ? ' bg-ink text-page border border-ink'
          : ' bg-surface text-ink border border-ink/20 active:scale-[0.99]')
      }
    >
      {teamColour && (
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: teamColour }} />
      )}
      <span className="font-medium flex-1 truncate">{label}</span>
      {guestBadge}
      {selected && <span className="text-xs uppercase tracking-wider">Selected</span>}
    </button>
  );
}

function GroupChip({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={
        'shrink-0 min-h-[36px] px-3 rounded-full text-xs font-semibold whitespace-nowrap transition ' +
        (active
          ? 'bg-ink text-page'
          : 'bg-surface text-ink border border-ink/20')
      }
    >
      {label}
    </button>
  );
}

function GuestBadge({ selected }) {
  return (
    <span
      className={
        'text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full ' +
        (selected
          ? 'bg-surface-2/15 text-page border border-surface-2/30'
          : 'bg-ink/15 text-ink/80 border border-ink/30')
      }
    >
      Guest
    </span>
  );
}

function ColourSelect({ value, taken, onChange }) {
  return (
    <label className="flex items-center gap-2">
      <span
        className="w-3.5 h-3.5 rounded-full shrink-0 border border-ink/40"
        style={{ background: BAG_HEX[value] }}
      />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-[36px] pl-2 pr-1 rounded-lg bg-surface border border-ink/20 text-ink text-sm font-semibold outline-none"
        aria-label="Bag colour"
      >
        {BAG_COLOURS.map((c) => (
          <option key={c} value={c} disabled={c === taken}>
            {BAG_LABEL[c]}
            {c === taken ? ' (taken)' : ''}
          </option>
        ))}
      </select>
    </label>
  );
}
