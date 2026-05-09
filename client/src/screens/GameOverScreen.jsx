import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { PrimaryButton, SecondaryButton, GhostButton } from '../components/Button.jsx';
import { BAG_HEX } from '../constants/colours.js';
import { fireWinnerConfetti } from '../lib/celebration.js';

export default function GameOverScreen() {
  const { id } = useParams();
  const [game, setGame] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    api(`/api/games/${id}`).then((d) => setGame(d.game)).catch(() => {});
  }, [id]);

  const stats = useMemo(() => (game ? computeStats(game) : null), [game]);
  const team1Hex = game ? BAG_HEX[game.team1Colour] : '#FFD700';
  const team2Hex = game ? BAG_HEX[game.team2Colour] : '#EF4444';
  const winning = game?.result?.winningTeam;
  const winnerHex = winning === 1 ? team1Hex : winning === 2 ? team2Hex : '#FAEEDA';

  useEffect(() => {
    if (!game) return;
    const t = setTimeout(() => fireWinnerConfetti(winnerHex, 3500), 200);
    return () => clearTimeout(t);
  }, [game, winnerHex]);

  if (!game) {
    return <div className="min-h-screen flex items-center justify-center text-[#FAEEDA]/70">Loading...</div>;
  }

  const team1 = game.players.filter((gp) => gp.team === 1);
  const team2 = game.players.filter((gp) => gp.team === 2);
  const result = game.result;
  const winners = winning ? (winning === 1 ? team1 : team2) : [];

  return (
    <div className="min-h-screen flex flex-col items-center px-5 py-8 max-w-md mx-auto text-center">
      <p className="text-xs uppercase tracking-[0.2em] text-[#FAEEDA]/60 mb-2">Game over</p>

      {winning ? (
        <>
          <h1
            className="winner-pop text-5xl sm:text-6xl font-black tracking-wider mb-1"
            style={{
              color: winnerHex,
              textShadow:
                '0 0 30px rgba(255, 215, 0, 0.35), 0 6px 0 rgba(0, 0, 0, 0.4), 0 12px 24px rgba(0, 0, 0, 0.55)',
            }}
          >
            WINNERS!
          </h1>
          <p className="text-lg font-semibold text-[#FAEEDA] mb-6">
            {winners.map((w) => w.player.username).join(' & ')}
          </p>
        </>
      ) : (
        <h1 className="text-3xl font-bold mb-6">Game ended</h1>
      )}

      {result && (
        <div className="grid grid-cols-2 gap-3 mb-6 w-full">
          <ScoreBox
            label={team1.map((gp) => gp.player.username).join(' & ') || 'Team 1'}
            score={result.team1Score}
            target={game.targetScore}
            colour={team1Hex}
            winner={winning === 1}
          />
          <ScoreBox
            label={team2.map((gp) => gp.player.username).join(' & ') || 'Team 2'}
            score={result.team2Score}
            target={game.targetScore}
            colour={team2Hex}
            winner={winning === 2}
          />
        </div>
      )}

      {stats && (
        <div className="w-full mb-8">
          <p className="text-xs uppercase tracking-wider text-[#FAEEDA]/60 mb-2">Highlights</p>
          <div className="grid grid-cols-2 gap-2">
            <StatTile label="Rounds" value={stats.rounds} />
            <StatTile label="Total throws" value={stats.totalThrows} />
            <StatTile
              label="Cornholes"
              value={`${stats.cornholes.team1} – ${stats.cornholes.team2}`}
              colour1={team1Hex}
              colour2={team2Hex}
            />
            <StatTile
              label="Best round"
              value={
                stats.bestRound
                  ? `+${stats.bestRound.netPoints} (R${stats.bestRound.roundNumber})`
                  : '–'
              }
              colour1={
                stats.bestRound?.scoringTeam === 1
                  ? team1Hex
                  : stats.bestRound?.scoringTeam === 2
                  ? team2Hex
                  : undefined
              }
            />
          </div>
          {stats.topThrower && (
            <div className="mt-2 p-3 rounded-2xl bg-[#082F58] border border-[#FAEEDA]/15 text-left">
              <p className="text-xs uppercase tracking-wider text-[#FAEEDA]/60">Top thrower</p>
              <p className="text-base font-semibold mt-1">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full mr-2 align-middle"
                  style={{ background: stats.topThrower.team === 1 ? team1Hex : team2Hex }}
                />
                {stats.topThrower.username}
                <span className="text-[#FAEEDA]/70 font-normal text-sm">
                  {' '}
                  &middot; {stats.topThrower.cornholes} cornhole{stats.topThrower.cornholes === 1 ? '' : 's'}
                </span>
              </p>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2 w-full">
        <PrimaryButton onClick={() => navigate('/setup')}>New game</PrimaryButton>
        <SecondaryButton onClick={() => navigate('/')}>Home</SecondaryButton>
        <GhostButton onClick={() => fireWinnerConfetti(winnerHex, 2500)}>More confetti!</GhostButton>
        <SecondaryButton onClick={() => navigate('/history')}>History</SecondaryButton>
      </div>
    </div>
  );
}

function ScoreBox({ label, score, target, colour, winner }) {
  return (
    <div
      className={
        'rounded-2xl p-4 border ' +
        (winner ? 'border-[#FAEEDA]' : 'border-[#FAEEDA]/20')
      }
      style={{
        background: 'rgba(8, 47, 88, 0.7)',
        boxShadow: winner ? `0 0 20px ${colour}55` : undefined,
      }}
    >
      <p className="text-xs uppercase tracking-wider text-[#FAEEDA]/70 truncate">{label}</p>
      <p className="text-5xl font-black mt-1" style={{ color: colour }}>
        {score}
      </p>
      <p className="text-[10px] uppercase tracking-wider text-[#FAEEDA]/50 mt-1">
        of {target}
      </p>
    </div>
  );
}

function StatTile({ label, value, colour1, colour2 }) {
  return (
    <div className="rounded-xl p-3 bg-[#082F58] border border-[#FAEEDA]/15 text-left">
      <p className="text-xs uppercase tracking-wider text-[#FAEEDA]/60">{label}</p>
      <p
        className="text-xl font-bold mt-0.5"
        style={
          colour1 && colour2
            ? {
                background: `linear-gradient(90deg, ${colour1} 0%, ${colour1} 50%, ${colour2} 50%, ${colour2} 100%)`,
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
              }
            : { color: colour1 || '#FAEEDA' }
        }
      >
        {value}
      </p>
    </div>
  );
}

function computeStats(game) {
  const rounds = game.rounds || [];
  const teamByPlayer = {};
  for (const gp of game.players) teamByPlayer[gp.playerId] = gp.team;

  let team1Cornholes = 0;
  let team2Cornholes = 0;
  let totalThrows = 0;
  let bestRound = null;
  const playerCornholes = {};

  for (const r of rounds) {
    if (bestRound == null || r.netPoints > bestRound.netPoints) {
      if (r.scoringTeam) bestRound = r;
    }
    for (const t of r.bagThrows) {
      totalThrows += 1;
      if (t.result === 'CORNHOLE') {
        if (teamByPlayer[t.playerId] === 1) team1Cornholes += 1;
        else if (teamByPlayer[t.playerId] === 2) team2Cornholes += 1;
        playerCornholes[t.playerId] = (playerCornholes[t.playerId] || 0) + 1;
      }
    }
  }

  let topThrower = null;
  for (const [pid, count] of Object.entries(playerCornholes)) {
    if (!topThrower || count > topThrower.cornholes) {
      const gp = game.players.find((g) => g.playerId === pid);
      topThrower = {
        username: gp?.player?.username || 'Player',
        team: gp?.team,
        cornholes: count,
      };
    }
  }

  return {
    rounds: rounds.length,
    totalThrows,
    cornholes: { team1: team1Cornholes, team2: team2Cornholes },
    bestRound,
    topThrower,
  };
}
