import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import Breadcrumb from '../components/Breadcrumb.jsx';
import GroupFilter from '../components/GroupFilter.jsx';

const COLUMNS = [
  { key: 'games', label: 'MP', title: 'Matches played' },
  { key: 'points', label: 'Pts', title: 'Points scored' },
  { key: 'avgPointsPerRound', label: 'Avg pts/rd', title: 'Average points per round' },
  { key: 'wins', label: 'W', title: 'Wins' },
  { key: 'winPct', label: 'Win %', title: 'Win percentage', pct: true },
  { key: 'losses', label: 'L', title: 'Losses' },
  { key: 'lossPct', label: 'Loss %', title: 'Loss percentage', pct: true },
  { key: 'accuracy', label: 'Acc', title: 'On-board throws (cornhole + board)' },
  { key: 'accuracyPct', label: 'Acc %', title: 'On-board percentage', pct: true },
  { key: 'cornholes', label: 'CH', title: 'Cornholes' },
  { key: 'cornholePct', label: 'CH %', title: 'Cornhole percentage', pct: true },
  { key: 'boards', label: 'Board', title: 'Board throws' },
  { key: 'boardPct', label: 'Board %', title: 'Board percentage', pct: true },
];

export default function LeaderboardScreen() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [groupId, setGroupId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState('winPct');
  const [sortDir, setSortDir] = useState('desc');

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (groupId) params.set('groupId', groupId);
    const qs = params.toString() ? `?${params.toString()}` : '';
    api(`/api/stats/leaderboard${qs}`)
      .then((d) => setRows(d.leaderboard))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [groupId]);

  function toggleSort(key) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  const sorted = useMemo(() => {
    const dir = sortDir === 'desc' ? -1 : 1;
    return [...rows].sort((a, b) => {
      if (a[sortKey] !== b[sortKey]) return (a[sortKey] - b[sortKey]) * dir;
      if (a.wins !== b.wins) return b.wins - a.wins;
      return a.username.localeCompare(b.username);
    });
  }, [rows, sortKey, sortDir]);

  return (
    <div className="min-h-screen px-5 py-6 max-w-md mx-auto">
      <header className="mb-5">
        <Breadcrumb
          crumbs={[
            { label: 'Home', path: '/' },
            { label: 'Settings', path: '/settings' },
            { label: 'Leaderboard' },
          ]}
        />
        <h1 className="text-2xl font-bold tracking-tight">Leaderboard</h1>
      </header>

      <GroupFilter value={groupId} onChange={setGroupId} />

      {loading ? (
        <p className="text-ink/70 text-sm">Loading...</p>
      ) : sorted.length === 0 ? (
        <p className="text-ink/70 text-sm">No completed games yet.</p>
      ) : (
        <>
          <p className="text-xs text-ink/60 mb-2">
            Tap a column heading to sort. Tap a player for their full stats.
          </p>
          <div className="overflow-x-auto rounded-xl">
            <table className="text-sm border-separate border-spacing-0 min-w-full">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-page text-left text-[10px] uppercase tracking-wider text-ink/60 font-semibold py-2 pr-2 border-b border-ink/20">
                    Player
                  </th>
                  {COLUMNS.map((c) => (
                    <th
                      key={c.key}
                      title={c.title}
                      onClick={() => toggleSort(c.key)}
                      className={
                        'text-right text-[10px] uppercase tracking-wider font-semibold py-2 px-2 border-b border-ink/20 cursor-pointer select-none whitespace-nowrap ' +
                        (sortKey === c.key ? 'text-ink' : 'text-ink/60')
                      }
                    >
                      {c.label}
                      {sortKey === c.key ? (sortDir === 'desc' ? ' ▼' : ' ▲') : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((r, i) => (
                  <tr
                    key={r.id}
                    onClick={() => navigate(`/stats/${r.id}`)}
                    className="cursor-pointer"
                  >
                    <td className="sticky left-0 z-10 bg-page py-2.5 pr-2 border-b border-ink/10">
                      <span className="inline-block w-5 text-ink/50 font-bold text-xs">
                        {i + 1}
                      </span>
                      <span className="font-semibold whitespace-nowrap">{r.username}</span>
                    </td>
                    {COLUMNS.map((c) => (
                      <td
                        key={c.key}
                        className={
                          'text-right py-2.5 px-2 border-b border-ink/10 tabular-nums whitespace-nowrap ' +
                          (sortKey === c.key ? 'font-bold text-[#FFD700]' : '')
                        }
                      >
                        {r[c.key]}
                        {c.pct ? '%' : ''}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
