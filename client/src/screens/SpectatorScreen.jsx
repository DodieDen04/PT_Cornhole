import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { GhostButton, SecondaryButton } from '../components/Button.jsx';
import { BAG_HEX } from '../constants/colours.js';

export default function SpectatorScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [game, setGame] = useState(null);
  const [round, setRound] = useState(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const wsRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    api(`/api/games/${id}`)
      .then((d) => {
        if (cancelled) return;
        setGame(d.game);
        const active = d.game.rounds?.length
          ? d.game.rounds.reduce((m, r) => (r.roundNumber > m.roundNumber ? r : m), d.game.rounds[0])
          : null;
        setRound(active);
      })
      .catch((e) => setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${window.location.host}/ws/spectate?gameId=${id}`);
    wsRef.current = ws;
    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'update') {
          if (msg.round) setRound(msg.round);
          if (msg.totals) setGame((g) => (g ? { ...g, ...msg.totals } : g));
          if (msg.game) setGame(msg.game);
        }
      } catch {}
    };
    return () => ws.close();
  }, [id]);

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6">
        <p className="text-[#EF4444]">{error}</p>
        <GhostButton onClick={() => navigate('/')}>Back home</GhostButton>
      </div>
    );
  }
  if (!game) {
    return <div className="min-h-screen flex items-center justify-center text-ink/70">Loading...</div>;
  }

  const team1 = game.players.filter((gp) => gp.team === 1);
  const team2 = game.players.filter((gp) => gp.team === 2);
  const team1Hex = BAG_HEX[game.team1Colour];
  const team2Hex = BAG_HEX[game.team2Colour];
  const winning = game.result?.winningTeam;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-8 max-w-md mx-auto text-center">
      <p className="text-xs uppercase tracking-[0.2em] text-ink/50 mb-2 flex items-center gap-2">
        <span
          className="w-2 h-2 rounded-full"
          style={{ background: connected ? '#22C55E' : '#EF4444' }}
        />
        {connected ? 'Live' : 'Reconnecting...'}
      </p>
      <h1 className="text-3xl font-bold mb-1">Spectating</h1>
      {game.status === 'COMPLETED' && winning && (
        <p className="text-base font-semibold mb-2">
          <span style={{ color: winning === 1 ? team1Hex : team2Hex }}>
            Team {winning} wins
          </span>
        </p>
      )}

      <div className="w-full grid grid-cols-2 gap-3 my-6">
        <ScoreCard
          label={team1.map((p) => p.player.username).join(' & ')}
          score={game.team1Score ?? game.result?.team1Score ?? 0}
          colour={team1Hex}
          highlight={winning === 1}
        />
        <ScoreCard
          label={team2.map((p) => p.player.username).join(' & ')}
          score={game.team2Score ?? game.result?.team2Score ?? 0}
          colour={team2Hex}
          highlight={winning === 2}
        />
      </div>

      <p className="text-xs uppercase tracking-wider text-ink/60 mb-1">First to {game.targetScore}</p>
      {round && (
        <div className="w-full p-3 rounded-2xl bg-surface border border-ink/15 text-sm">
          <p className="text-xs uppercase tracking-wider text-ink/60 mb-1">
            Round {round.roundNumber} &middot; {round.bagThrows?.length || 0}/8 thrown
          </p>
          <p>
            <span style={{ color: team1Hex }}>T1: {round.team1RoundScore}</span>
            {' '}&middot;{' '}
            <span style={{ color: team2Hex }}>T2: {round.team2RoundScore}</span>
          </p>
          <p className="text-xs text-ink/60 mt-1">
            {round.netPoints === 0
              ? 'Tied this round'
              : `+${round.netPoints} pending to Team ${round.scoringTeam}`}
          </p>
        </div>
      )}

      <SecondaryButton className="mt-6" onClick={() => navigate('/')}>Home</SecondaryButton>
    </div>
  );
}

function ScoreCard({ label, score, colour, highlight }) {
  return (
    <div
      className={
        'rounded-2xl p-3 border ' +
        (highlight ? 'border-ink' : 'border-ink/20')
      }
      style={{ background: 'rgba(8, 47, 88, 0.7)' }}
    >
      <div className="flex items-center gap-2 justify-center">
        <span className="w-3 h-3 rounded-full" style={{ background: colour }} />
        <span className="text-xs uppercase tracking-wider text-ink/70 truncate">{label}</span>
      </div>
      <div className="text-4xl font-black mt-1" style={{ color: colour }}>
        {score}
      </div>
    </div>
  );
}
