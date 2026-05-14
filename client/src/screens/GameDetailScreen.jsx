import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { GhostButton } from '../components/Button.jsx';
import Board from '../components/Board.jsx';
import { BAG_HEX } from '../constants/colours.js';

export default function GameDetailScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [game, setGame] = useState(null);

  useEffect(() => {
    api(`/api/games/${id}`).then((d) => setGame(d.game)).catch(() => {});
  }, [id]);

  if (!game) {
    return <div className="min-h-screen flex items-center justify-center text-ink/70">Loading...</div>;
  }

  const team1 = game.players.filter((gp) => gp.team === 1);
  const team2 = game.players.filter((gp) => gp.team === 2);
  const team1Hex = BAG_HEX[game.team1Colour];
  const team2Hex = BAG_HEX[game.team2Colour];
  const winning = game.result?.winningTeam;
  const date = new Date(game.createdAt).toLocaleString();

  const teamByPlayer = {};
  for (const gp of game.players) teamByPlayer[gp.playerId] = gp.team;

  return (
    <div className="min-h-screen px-5 py-6 max-w-md mx-auto pb-12">
      <header className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-ink/60">Game replay</p>
          <h1 className="text-xl font-bold tracking-tight">{date}</h1>
        </div>
        <GhostButton onClick={() => navigate('/history')}>Back</GhostButton>
      </header>

      <div className="grid grid-cols-2 gap-2 mb-5">
        <TeamHead
          names={team1.map((gp) => gp.player.username)}
          score={game.result?.team1Score ?? 0}
          colour={team1Hex}
          winner={winning === 1}
        />
        <TeamHead
          names={team2.map((gp) => gp.player.username)}
          score={game.result?.team2Score ?? 0}
          colour={team2Hex}
          winner={winning === 2}
        />
      </div>

      <div className="flex flex-col gap-6">
        {game.rounds.map((r) => {
          const bags = r.bagThrows.map((t, i) => ({
            id: t.id,
            boardX: t.boardX,
            boardY: t.boardY,
            result: t.result,
            colour: teamByPlayer[t.playerId] === 1 ? game.team1Colour : game.team2Colour,
            label: String(i + 1),
          }));
          return (
            <section key={r.id} className="border-t border-ink/10 pt-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold">
                  Round {r.roundNumber}
                  <span className="text-ink/60 font-normal ml-2">
                    ({r.throwingPair === 1 ? 'End A' : 'End B'} pair)
                  </span>
                </h2>
                <span className="text-xs text-ink/60">
                  T1 {r.team1RoundScore} &middot; T2 {r.team2RoundScore}
                </span>
              </div>
              <Board bags={bags} disabled />
              <p className="text-sm font-semibold text-center mt-2">
                {r.netPoints === 0
                  ? 'Tied (no points)'
                  : `+${r.netPoints} to Team ${r.scoringTeam}`}
              </p>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function TeamHead({ names, score, colour, winner }) {
  return (
    <div
      className={
        'rounded-2xl p-3 border ' +
        (winner ? 'border-ink' : 'border-ink/20')
      }
      style={{ background: 'rgba(8, 47, 88, 0.7)' }}
    >
      <div className="flex items-center gap-2">
        <span className="w-3 h-3 rounded-full" style={{ background: colour }} />
        <span className="text-xs uppercase tracking-wider text-ink/70 truncate">
          {names.join(' & ')}
        </span>
      </div>
      <div className="text-3xl font-bold mt-1" style={{ color: colour }}>{score}</div>
      {winner && (
        <p className="text-[10px] uppercase tracking-wider text-ink mt-1">Winner</p>
      )}
    </div>
  );
}
