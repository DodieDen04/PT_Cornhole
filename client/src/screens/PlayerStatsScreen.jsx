import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { GhostButton, SecondaryButton } from '../components/Button.jsx';
import { toCsv, downloadCsv } from '../lib/csv.js';
import Heatmap, { HeatmapLegend } from '../components/Heatmap.jsx';
import TrendChart from '../components/TrendChart.jsx';
import GroupFilter from '../components/GroupFilter.jsx';

const MODE_FILTERS = [
  { label: 'All', value: '' },
  { label: 'Competitive', value: 'COMPETITIVE' },
  { label: 'Practice', value: 'PRACTICE' },
];
const RESULT_FILTERS = [
  { label: 'All', value: '' },
  { label: 'Cornholes', value: 'CORNHOLE' },
  { label: 'Board', value: 'BOARD' },
  { label: 'Off', value: 'OFF' },
];
const RANGE_FILTERS = [
  { label: 'All time', days: null },
  { label: '30 days', days: 30 },
  { label: '7 days', days: 7 },
];

export default function PlayerStatsScreen() {
  const { id: routeId } = useParams();
  const navigate = useNavigate();
  const { player: me } = useAuth();
  const playerId = routeId || me.id;

  const [stats, setStats] = useState(null);
  const [players, setPlayers] = useState([]);
  const [throws, setThrows] = useState([]);
  const [mode, setMode] = useState('');
  const [resultFilter, setResultFilter] = useState('');
  const [rangeDays, setRangeDays] = useState(null);
  const [opponentId, setOpponentId] = useState('');
  const [h2h, setH2h] = useState(null);
  const [groupId, setGroupId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (groupId) params.set('groupId', groupId);
    const qs = params.toString() ? `?${params.toString()}` : '';
    Promise.all([
      api(`/api/stats/player/${playerId}${qs}`),
      api('/api/players'),
    ])
      .then(([s, p]) => {
        setStats(s.stats);
        setPlayers(p.players);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [playerId, groupId]);

  useEffect(() => {
    const params = new URLSearchParams({ playerId });
    if (mode) params.set('mode', mode);
    if (resultFilter) params.set('result', resultFilter);
    if (rangeDays) {
      const from = new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000).toISOString();
      params.set('dateFrom', from);
    }
    if (groupId) params.set('groupId', groupId);
    api(`/api/stats/heatmap?${params.toString()}`)
      .then((d) => setThrows(d.throws))
      .catch(() => setThrows([]));
  }, [playerId, mode, resultFilter, rangeDays, groupId]);

  useEffect(() => {
    if (!opponentId) {
      setH2h(null);
      return;
    }
    const params = new URLSearchParams({ player1Id: playerId, player2Id: opponentId });
    if (groupId) params.set('groupId', groupId);
    api(`/api/stats/head-to-head?${params.toString()}`)
      .then(setH2h)
      .catch(() => setH2h(null));
  }, [playerId, opponentId, groupId]);

  const otherPlayers = useMemo(
    () => players.filter((p) => p.id !== playerId),
    [players, playerId],
  );

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-[#FAEEDA]/70">Loading...</div>;
  }
  if (!stats) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6">
        <p className="text-[#EF4444]">Could not load stats.</p>
        <GhostButton onClick={() => navigate('/')}>Back home</GhostButton>
      </div>
    );
  }

  const { competitive: c, practice: p, player } = stats;

  return (
    <div className="min-h-screen px-5 py-6 max-w-md mx-auto pb-12">
      <header className="flex items-center justify-between mb-5">
        <div>
          <p className="text-xs uppercase tracking-wider text-[#FAEEDA]/60">Stats</p>
          <h1 className="text-2xl font-bold tracking-tight">{player.username}</h1>
        </div>
        <GhostButton onClick={() => navigate('/')}>Home</GhostButton>
      </header>

      <GroupFilter value={groupId} onChange={setGroupId} />

      <section className="mb-5">
        <p className="text-xs uppercase tracking-wider text-[#FAEEDA]/60 mb-2">Competitive</p>
        <div className="grid grid-cols-3 gap-2">
          <Tile label="Win %" value={`${c.winPct}%`} />
          <Tile label="W – L" value={`${c.won} – ${c.lost}`} />
          <Tile label="Streak" value={c.currentStreak ? `${c.currentStreak}${c.currentStreakType}` : '–'} />
        </div>
        <div className="grid grid-cols-3 gap-2 mt-2">
          <Tile label="Cornhole %" value={`${c.cornholePct}%`} colour="#FFD700" />
          <Tile label="Board %" value={`${c.boardPct}%`} colour="#D4B58F" />
          <Tile label="Off %" value={`${c.offPct}%`} colour="#EF4444" />
        </div>
        <div className="grid grid-cols-2 gap-2 mt-2">
          <Tile label="Avg pts/round" value={c.avgPointsPerRound} />
          <Tile label="Total throws" value={c.totalThrows} />
        </div>
      </section>

      {p.totalThrows > 0 && (
        <section className="mb-5">
          <p className="text-xs uppercase tracking-wider text-[#FAEEDA]/60 mb-2">Practice</p>
          <div className="grid grid-cols-3 gap-2">
            <Tile label="Sets" value={p.totalSets} />
            <Tile label="Throws" value={p.totalThrows} />
            <Tile label="Cornhole %" value={`${p.cornholePct}%`} colour="#FFD700" />
          </div>
        </section>
      )}

      <section className="mb-5">
        <p className="text-xs uppercase tracking-wider text-[#FAEEDA]/60 mb-2">
          Cornhole accuracy trend
        </p>
        <TrendChart trend={stats.trend || []} />
      </section>

      {otherPlayers.length > 0 && (
        <section className="mb-5">
          <p className="text-xs uppercase tracking-wider text-[#FAEEDA]/60 mb-2">Head to head</p>
          <select
            value={opponentId}
            onChange={(e) => setOpponentId(e.target.value)}
            className="w-full min-h-[44px] px-3 rounded-xl bg-[#082F58] border border-[#FAEEDA]/20 text-[#FAEEDA] outline-none"
          >
            <option value="">Select opponent...</option>
            {otherPlayers.map((p) => (
              <option key={p.id} value={p.id}>{p.username}</option>
            ))}
          </select>
          {h2h && (
            <div className="mt-2 p-3 rounded-xl bg-[#082F58] border border-[#FAEEDA]/15 text-sm">
              {h2h.totalGames === 0 ? (
                <em className="text-[#FAEEDA]/60">No games as opponents yet.</em>
              ) : (
                <p>
                  <strong>{player.username}</strong> {h2h.player1Wins} &ndash; {h2h.player2Wins}{' '}
                  <strong>{otherPlayers.find((o) => o.id === opponentId)?.username}</strong>
                  <span className="text-[#FAEEDA]/60"> &middot; {h2h.totalGames} games</span>
                </p>
              )}
            </div>
          )}
        </section>
      )}

      <section className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs uppercase tracking-wider text-[#FAEEDA]/60">Heatmap</p>
          <span className="text-xs text-[#FAEEDA]/60">{throws.length} throws</span>
        </div>

        <FilterRow
          options={MODE_FILTERS}
          value={mode}
          onChange={setMode}
        />
        <FilterRow
          options={RESULT_FILTERS}
          value={resultFilter}
          onChange={setResultFilter}
        />
        <FilterRow
          options={RANGE_FILTERS.map((r) => ({ label: r.label, value: String(r.days ?? '') }))}
          value={String(rangeDays ?? '')}
          onChange={(v) => setRangeDays(v ? Number(v) : null)}
        />

        <div className="mt-3">
          <Heatmap throws={throws} />
          <HeatmapLegend />
        </div>
      </section>

      <SecondaryButton className="w-full" onClick={() => navigate('/leaderboard')}>
        See leaderboard
      </SecondaryButton>

      <SecondaryButton
        className="w-full mt-2"
        onClick={() => {
          const csv = toCsv(throws, [
            { label: 'x', key: 'x' },
            { label: 'y', key: 'y' },
            { label: 'result', key: 'result' },
          ]);
          downloadCsv(`pt-throws-${player.username}.csv`, csv);
        }}
        disabled={throws.length === 0}
      >
        Download throws CSV ({throws.length})
      </SecondaryButton>
    </div>
  );
}

function Tile({ label, value, colour }) {
  return (
    <div className="rounded-xl p-3 bg-[#082F58] border border-[#FAEEDA]/15 text-left">
      <p className="text-[10px] uppercase tracking-wider text-[#FAEEDA]/60">{label}</p>
      <p className="text-xl font-bold mt-0.5" style={{ color: colour || '#FAEEDA' }}>
        {value}
      </p>
    </div>
  );
}

function FilterRow({ options, value, onChange }) {
  return (
    <div className="flex gap-1 mb-2">
      {options.map((o) => (
        <button
          key={o.label}
          onClick={() => onChange(o.value)}
          className={
            'flex-1 min-h-[36px] rounded-lg text-xs font-semibold ' +
            (value === o.value
              ? 'bg-[#FAEEDA] text-[#0C447C]'
              : 'bg-[#082F58] text-[#FAEEDA] border border-[#FAEEDA]/20')
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
