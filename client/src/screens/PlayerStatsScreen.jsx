import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { GhostButton, SecondaryButton } from '../components/Button.jsx';
import Breadcrumb from '../components/Breadcrumb.jsx';
import { toCsv, downloadCsv } from '../lib/csv.js';
import Heatmap, { HeatmapLegend } from '../components/Heatmap.jsx';
import TrendChart from '../components/TrendChart.jsx';
import RecentFormChart from '../components/RecentFormChart.jsx';
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
const FORMAT_FILTERS = [
  { label: 'All formats', value: '' },
  { label: '1v1', value: '1v1' },
  { label: '2v2', value: '2v2' },
];

const TREND_METRICS = [
  { label: 'Cornhole', value: 'CORNHOLE', key: 'cornholes', colour: '#FFD700' },
  { label: 'Board', value: 'BOARD', key: 'boards', colour: '#D4B58F' },
  { label: 'Off', value: 'OFF', key: 'offs', colour: '#EF4444' },
];
const TREND_RANGES = [
  { label: '1 day', days: 1 },
  { label: '30 days', days: 30 },
  { label: '3 months', days: 91 },
  { label: '6 months', days: 183 },
  { label: '1 year', days: 365 },
  { label: 'All time', days: 0 },
];
const FORM_METRICS = [
  { label: 'Win / Loss', value: 'WINLOSS' },
  { label: 'Cornhole', value: 'CORNHOLE', colour: '#FFD700' },
  { label: 'Board', value: 'BOARD', colour: '#D4B58F' },
  { label: 'Off', value: 'OFF', colour: '#EF4444' },
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
  const [format, setFormat] = useState('');
  const [opponentId, setOpponentId] = useState('');
  const [h2h, setH2h] = useState(null);
  const [groupId, setGroupId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [trendMetric, setTrendMetric] = useState('CORNHOLE');
  const [trendRange, setTrendRange] = useState(0);
  const [trendUnit, setTrendUnit] = useState('pct');
  const [formMetric, setFormMetric] = useState('WINLOSS');
  const [formUnit, setFormUnit] = useState('pct');

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
    if (format) params.set('format', format);
    api(`/api/stats/heatmap?${params.toString()}`)
      .then((d) => setThrows(d.throws))
      .catch(() => setThrows([]));
  }, [playerId, mode, resultFilter, rangeDays, groupId, format]);

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

  const trendPoints = useMemo(() => {
    const entries = stats?.trend || [];
    const metricDef = TREND_METRICS.find((m) => m.value === trendMetric);
    const cutoff = trendRange ? Date.now() - trendRange * 24 * 60 * 60 * 1000 : null;
    return entries
      .filter((e) => !cutoff || new Date(e.completedAt).getTime() >= cutoff)
      .map((e) => {
        const count = e[metricDef.key] || 0;
        return {
          mode: e.mode,
          throws: e.throws,
          count,
          value:
            trendUnit === 'pct'
              ? e.throws > 0
                ? Math.round((count / e.throws) * 1000) / 10
                : 0
              : count,
        };
      });
  }, [stats, trendMetric, trendRange, trendUnit]);

  const recentGames = useMemo(
    () => (stats?.trend || []).filter((e) => e.mode === 'COMPETITIVE').slice(-10),
    [stats],
  );

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-ink/70">Loading...</div>;
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
  const isOwn = playerId === me.id;
  const crumbs = isOwn
    ? [
        { label: 'Home', path: '/' },
        { label: 'Settings', path: '/settings' },
        { label: 'My stats' },
      ]
    : [
        { label: 'Home', path: '/' },
        { label: 'Leaderboard', path: '/leaderboard' },
        { label: player.username },
      ];

  return (
    <div className="min-h-screen px-5 py-6 max-w-md mx-auto pb-12">
      <header className="mb-5">
        <Breadcrumb crumbs={crumbs} />
        <p className="text-xs uppercase tracking-wider text-ink/60">Stats</p>
        <h1 className="text-2xl font-bold tracking-tight">{player.username}</h1>
      </header>

      <GroupFilter value={groupId} onChange={setGroupId} />

      <section className="mb-5">
        <p className="text-xs uppercase tracking-wider text-ink/60 mb-2">Competitive</p>
        <div className="grid grid-cols-2 gap-2">
          <Tile label="Games" value={c.gamesPlayed} />
          <Tile label="Win %" value={`${c.winPct}%`} />
          <Tile label="W – L" value={`${c.won} – ${c.lost}`} />
          <Tile label="Streak" value={c.currentStreak ? `${c.currentStreak}${c.currentStreakType}` : '–'} />
        </div>
        <div className="grid grid-cols-3 gap-2 mt-2">
          <Tile
            label="Cornhole"
            value={`${c.cornholePct}%`}
            sub={`${c.cornholes} of ${c.totalThrows}`}
            colour="#FFD700"
          />
          <Tile
            label="Board"
            value={`${c.boardPct}%`}
            sub={`${c.boards} of ${c.totalThrows}`}
            colour="#D4B58F"
          />
          <Tile
            label="Off"
            value={`${c.offPct}%`}
            sub={`${c.offs} of ${c.totalThrows}`}
            colour="#EF4444"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 mt-2">
          <Tile label="Avg pts/round" value={c.avgPointsPerRound} />
          <Tile label="Total throws" value={c.totalThrows} />
        </div>
      </section>

      {p.totalThrows > 0 && (
        <section className="mb-5">
          <p className="text-xs uppercase tracking-wider text-ink/60 mb-2">Practice</p>
          <div className="grid grid-cols-3 gap-2">
            <Tile label="Sets" value={p.totalSets} />
            <Tile label="Throws" value={p.totalThrows} />
            <Tile
              label="Cornhole"
              value={`${p.cornholePct}%`}
              sub={`${p.cornholes} of ${p.totalThrows}`}
              colour="#FFD700"
            />
          </div>
        </section>
      )}

      <section className="mb-5">
        <p className="text-xs uppercase tracking-wider text-ink/60 mb-2">
          Accuracy trend
        </p>
        <div className="flex gap-2 mb-2">
          <select
            value={trendMetric}
            onChange={(e) => setTrendMetric(e.target.value)}
            className="flex-1 min-h-[40px] px-2 rounded-xl bg-surface border border-ink/20 text-ink text-sm outline-none"
          >
            {TREND_METRICS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
          <select
            value={trendRange}
            onChange={(e) => setTrendRange(Number(e.target.value))}
            className="flex-1 min-h-[40px] px-2 rounded-xl bg-surface border border-ink/20 text-ink text-sm outline-none"
          >
            {TREND_RANGES.map((r) => (
              <option key={r.label} value={r.days}>{r.label}</option>
            ))}
          </select>
          <UnitToggle value={trendUnit} onChange={setTrendUnit} />
        </div>
        <TrendChart
          points={trendPoints}
          unit={trendUnit}
          colour={TREND_METRICS.find((m) => m.value === trendMetric).colour}
        />
      </section>

      <section className="mb-5">
        <p className="text-xs uppercase tracking-wider text-ink/60 mb-2">
          Recent form (last 10 games)
        </p>
        <div className="flex gap-2 mb-2">
          <select
            value={formMetric}
            onChange={(e) => setFormMetric(e.target.value)}
            className="flex-1 min-h-[40px] px-2 rounded-xl bg-surface border border-ink/20 text-ink text-sm outline-none"
          >
            {FORM_METRICS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
          {formMetric !== 'WINLOSS' && (
            <UnitToggle value={formUnit} onChange={setFormUnit} />
          )}
        </div>
        <RecentFormChart
          games={recentGames}
          metric={formMetric}
          unit={formUnit}
          colour={FORM_METRICS.find((m) => m.value === formMetric)?.colour || '#FFD700'}
        />
      </section>

      {otherPlayers.length > 0 && (
        <section className="mb-5">
          <p className="text-xs uppercase tracking-wider text-ink/60 mb-2">Head to head</p>
          <select
            value={opponentId}
            onChange={(e) => setOpponentId(e.target.value)}
            className="w-full min-h-[44px] px-3 rounded-xl bg-surface border border-ink/20 text-ink outline-none"
          >
            <option value="">Select opponent...</option>
            {otherPlayers.map((p) => (
              <option key={p.id} value={p.id}>{p.username}</option>
            ))}
          </select>
          {h2h && (
            <div className="mt-2 p-3 rounded-xl bg-surface border border-ink/15 text-sm">
              {h2h.totalGames === 0 ? (
                <em className="text-ink/60">No games as opponents yet.</em>
              ) : (
                <p>
                  <strong>{player.username}</strong> {h2h.player1Wins} &ndash; {h2h.player2Wins}{' '}
                  <strong>{otherPlayers.find((o) => o.id === opponentId)?.username}</strong>
                  <span className="text-ink/60"> &middot; {h2h.totalGames} games</span>
                </p>
              )}
            </div>
          )}
        </section>
      )}

      <section className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs uppercase tracking-wider text-ink/60">Heatmap</p>
          <span className="text-xs text-ink/60">{throws.length} throws</span>
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
        <FilterRow
          options={FORMAT_FILTERS}
          value={format}
          onChange={setFormat}
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

function Tile({ label, value, sub, colour }) {
  return (
    <div className="rounded-xl p-3 bg-surface border border-ink/15 text-left">
      <p className="text-[10px] uppercase tracking-wider text-ink/60">{label}</p>
      <p className="text-xl font-bold mt-0.5" style={{ color: colour || 'var(--pt-ink)' }}>
        {value}
      </p>
      {sub && <p className="text-[10px] text-ink/60 mt-0.5">{sub}</p>}
    </div>
  );
}

function UnitToggle({ value, onChange }) {
  return (
    <div className="flex rounded-xl border border-ink/20 overflow-hidden shrink-0">
      {[
        { label: '%', v: 'pct' },
        { label: '#', v: 'raw' },
      ].map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          className={
            'min-h-[40px] px-3 text-sm font-semibold ' +
            (value === o.v ? 'bg-ink text-page' : 'bg-surface text-ink')
          }
        >
          {o.label}
        </button>
      ))}
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
              ? 'bg-ink text-page'
              : 'bg-surface text-ink border border-ink/20')
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
