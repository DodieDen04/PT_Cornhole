import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { GhostButton } from '../components/Button.jsx';
import GroupFilter from '../components/GroupFilter.jsx';

export default function LeaderboardScreen() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [minGames, setMinGames] = useState(1);
  const [groupId, setGroupId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ minGames: String(minGames) });
    if (groupId) params.set('groupId', groupId);
    api(`/api/stats/leaderboard?${params.toString()}`)
      .then((d) => setRows(d.leaderboard))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [minGames, groupId]);

  return (
    <div className="min-h-screen px-5 py-6 max-w-md mx-auto">
      <header className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-bold tracking-tight">Leaderboard</h1>
        <GhostButton onClick={() => navigate('/')}>Home</GhostButton>
      </header>

      <GroupFilter value={groupId} onChange={setGroupId} />

      <div className="flex gap-2 mb-4">
        {[1, 3, 5].map((m) => (
          <button
            key={m}
            onClick={() => setMinGames(m)}
            className={
              'flex-1 min-h-[40px] rounded-xl text-sm font-semibold ' +
              (minGames === m
                ? 'bg-[#FAEEDA] text-[#0C447C]'
                : 'bg-[#082F58] text-[#FAEEDA] border border-[#FAEEDA]/20')
            }
          >
            Min {m} game{m === 1 ? '' : 's'}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-[#FAEEDA]/70 text-sm">Loading...</p>
      ) : rows.length === 0 ? (
        <p className="text-[#FAEEDA]/70 text-sm">No qualifying players yet.</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {rows.map((r, i) => (
            <li
              key={r.id}
              className="flex items-center gap-3 p-3 rounded-2xl bg-[#082F58] border border-[#FAEEDA]/15 cursor-pointer hover:border-[#FAEEDA]/40"
              onClick={() => navigate(`/stats/${r.id}`)}
            >
              <span className="w-7 text-center text-2xl font-black text-[#FAEEDA]/80">{i + 1}</span>
              <div className="flex-1">
                <p className="font-semibold">{r.username}</p>
                <p className="text-xs text-[#FAEEDA]/60">
                  {r.wins}W &middot; {r.losses}L &middot; {r.games} games
                </p>
              </div>
              <span className="text-xl font-black text-[#FFD700]">{r.winPct}%</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
