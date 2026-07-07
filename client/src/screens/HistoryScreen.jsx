import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { SecondaryButton } from '../components/Button.jsx';
import Breadcrumb from '../components/Breadcrumb.jsx';
import { BAG_HEX } from '../constants/colours.js';
import { toCsv, downloadCsv } from '../lib/csv.js';

const FILTERS = [
  { label: 'Matches', mode: 'COMPETITIVE' },
  { label: 'Practice', mode: 'PRACTICE' },
];

export default function HistoryScreen() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState('COMPETITIVE');
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('mode', filter);
    params.set('status', 'COMPLETED');
    api(`/api/games?${params.toString()}`)
      .then((d) => setGames(d.games))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filter]);

  return (
    <div className="min-h-screen px-5 py-6 max-w-md mx-auto">
      <header className="mb-6">
        <Breadcrumb
          crumbs={[
            { label: 'Home', path: '/' },
            { label: 'Settings', path: '/settings' },
            { label: 'History' },
          ]}
        />
        <h1 className="text-2xl font-bold tracking-tight">History</h1>
      </header>

      {games.length > 0 && (
        <div className="mb-3">
          <SecondaryButton
            className="w-full"
            onClick={() => {
              const csv = toCsv(games, [
                { label: 'date', get: (g) => new Date(g.createdAt).toISOString() },
                { label: 'mode', key: 'mode' },
                { label: 'status', key: 'status' },
                {
                  label: 'team1',
                  get: (g) =>
                    g.players.filter((p) => p.team === 1).map((p) => p.player.username).join(' & '),
                },
                {
                  label: 'team2',
                  get: (g) =>
                    g.players.filter((p) => p.team === 2).map((p) => p.player.username).join(' & '),
                },
                { label: 'team1Score', get: (g) => g.result?.team1Score ?? '' },
                { label: 'team2Score', get: (g) => g.result?.team2Score ?? '' },
                { label: 'winningTeam', get: (g) => g.result?.winningTeam ?? '' },
                { label: 'targetScore', key: 'targetScore' },
                { label: 'tag', key: 'practiceTag' },
              ]);
              downloadCsv('pt-games.csv', csv);
            }}
          >
            Download games CSV ({games.length})
          </SecondaryButton>
        </div>
      )}

      <div className="flex gap-2 mb-4">
        {FILTERS.map((f) => (
          <button
            key={f.label}
            onClick={() => setFilter(f.mode)}
            className={
              'flex-1 min-h-[40px] rounded-xl text-sm font-semibold ' +
              (filter === f.mode
                ? 'bg-ink text-page'
                : 'bg-surface text-ink border border-ink/20')
            }
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-ink/70 text-sm">Loading...</p>
      ) : games.length === 0 ? (
        <p className="text-ink/70 text-sm">No games yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {games.map((g) => (
            <li
              key={g.id}
              onClick={() => {
                if (g.status !== 'COMPLETED') return;
                if (g.mode === 'COMPETITIVE') navigate(`/history/games/${g.id}`);
                else navigate(`/history/practice/${g.id}`);
              }}
              className={
                'p-3 rounded-2xl bg-surface border border-ink/15 ' +
                (g.status === 'COMPLETED' ? 'cursor-pointer hover:border-ink/40' : 'opacity-70')
              }
            >
              {g.mode === 'COMPETITIVE' ? (
                <CompetitiveRow game={g} />
              ) : (
                <PracticeRow game={g} />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CompetitiveRow({ game }) {
  const t1 = game.players.filter((gp) => gp.team === 1);
  const t2 = game.players.filter((gp) => gp.team === 2);
  const t1Hex = BAG_HEX[game.team1Colour];
  const t2Hex = BAG_HEX[game.team2Colour];
  const result = game.result;
  const winning = result?.winningTeam;
  const date = new Date(game.createdAt).toLocaleString();
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-ink/60">{date}</span>
        <StatusTag status={game.status} />
      </div>
      <div className="flex items-center justify-between gap-2">
        <TeamLabel hex={t1Hex} winner={winning === 1} names={t1.map((p) => p.player.username)} score={result?.team1Score} />
        <span className="text-ink/40 text-xs">vs</span>
        <TeamLabel hex={t2Hex} winner={winning === 2} names={t2.map((p) => p.player.username)} score={result?.team2Score} />
      </div>
    </div>
  );
}

function TeamLabel({ hex, winner, names, score }) {
  return (
    <div className="flex-1 text-sm">
      <div className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: hex }} />
        {winner && <span className="text-xs uppercase font-bold text-ink">won</span>}
      </div>
      <p className="truncate" style={{ color: hex }}>{names.join(' & ')}</p>
      {score != null && <p className="text-2xl font-bold" style={{ color: hex }}>{score}</p>}
    </div>
  );
}

function PracticeRow({ game }) {
  const date = new Date(game.createdAt).toLocaleString();
  const playerNames = game.players.map((gp) => gp.player.username).join(' & ');
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-ink/60">{date}</span>
        <StatusTag status={game.status} />
      </div>
      <p className="text-sm font-medium">Practice &middot; {playerNames}</p>
      {game.practiceTag && (
        <p className="text-xs text-ink/70">Tag: {game.practiceTag}</p>
      )}
    </div>
  );
}

function StatusTag({ status }) {
  const map = {
    IN_PROGRESS: { label: 'In progress', cls: 'bg-ink/20 text-ink' },
    COMPLETED: { label: 'Completed', cls: 'bg-[#22C55E]/20 text-[#22C55E]' },
    ABANDONED: { label: 'Abandoned', cls: 'bg-[#EF4444]/20 text-[#EF4444]' },
  };
  const s = map[status] || map.IN_PROGRESS;
  return (
    <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${s.cls}`}>
      {s.label}
    </span>
  );
}
