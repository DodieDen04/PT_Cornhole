import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { PrimaryButton, SecondaryButton, GhostButton } from '../components/Button.jsx';

export default function TournamentDetailScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    api(`/api/tournaments/${id}`).then(setData).catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function startMatch(matchId) {
    setBusy(true);
    setError(null);
    try {
      const { gameId } = await api(`/api/tournaments/${id}/matches/${matchId}/start`, {
        method: 'POST',
      });
      navigate(`/game/${gameId}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function continueMatch(gameId) {
    navigate(`/game/${gameId}`);
  }

  if (!data) {
    return <div className="min-h-screen flex items-center justify-center text-ink/70">Loading...</div>;
  }

  const { tournament, standings } = data;
  const isComplete = tournament.status === 'COMPLETED';
  const winner = isComplete && standings.length > 0 ? standings[0] : null;

  return (
    <div className="min-h-screen px-5 py-6 max-w-md mx-auto pb-12">
      <header className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-ink/60">
            Tournament &middot; {isComplete ? 'Final' : 'Live'}
          </p>
          <h1 className="text-xl font-bold tracking-tight">{tournament.name || 'Tournament'}</h1>
          <p className="text-xs text-ink/60">
            Round-robin &middot; first to {tournament.targetScore}
          </p>
        </div>
        <GhostButton onClick={() => navigate('/tournaments')}>Back</GhostButton>
      </header>

      {winner && (
        <div className="my-4 p-4 rounded-2xl bg-[#FFD700]/15 border border-[#FFD700]/40 text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-[#FFD700]">Champion</p>
          <p className="text-2xl font-black mt-1">{winner.username}</p>
          <p className="text-xs text-ink/70 mt-1">
            {winner.wins} W &middot; {winner.losses} L
          </p>
        </div>
      )}

      <section className="mb-5">
        <p className="text-xs uppercase tracking-wider text-ink/60 mb-2">Standings</p>
        <ol className="flex flex-col gap-1.5">
          {standings.map((s, i) => (
            <li
              key={s.playerId}
              className="flex items-center gap-3 p-2 rounded-xl bg-surface border border-ink/15"
            >
              <span className="w-6 text-center font-black text-ink/80">{i + 1}</span>
              <span className="flex-1 font-medium">{s.username}</span>
              <span className="text-xs text-ink/60">
                {s.wins}W &middot; {s.losses}L
              </span>
              <span
                className="text-sm font-bold"
                style={{ color: s.pointsFor - s.pointsAgainst >= 0 ? '#FFD700' : '#EF4444' }}
              >
                {s.pointsFor - s.pointsAgainst >= 0 ? '+' : ''}
                {s.pointsFor - s.pointsAgainst}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="mb-5">
        <p className="text-xs uppercase tracking-wider text-ink/60 mb-2">Matches</p>
        <ul className="flex flex-col gap-2">
          {tournament.matches.map((m) => {
            const played = !!m.gameId && m.game?.status === 'COMPLETED';
            const inProgress = !!m.gameId && m.game?.status === 'IN_PROGRESS';
            const r = m.game?.result;
            return (
              <li
                key={m.id}
                className="p-3 rounded-xl bg-surface border border-ink/15"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-ink/60">Match {m.matchOrder}</span>
                  {played && (
                    <span className="text-[10px] uppercase tracking-wider text-[#22C55E]">Played</span>
                  )}
                  {inProgress && (
                    <span className="text-[10px] uppercase tracking-wider text-[#FFD700]">In progress</span>
                  )}
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className={m.winnerId === m.player1Id ? 'font-bold' : ''}>
                    {m.player1.username}
                  </span>
                  <span className="text-ink/70">
                    {r ? `${r.team1Score} – ${r.team2Score}` : 'vs'}
                  </span>
                  <span className={m.winnerId === m.player2Id ? 'font-bold' : ''}>
                    {m.player2.username}
                  </span>
                </div>
                {!played && !inProgress && !isComplete && (
                  <PrimaryButton
                    className="w-full mt-2 text-sm"
                    disabled={busy}
                    onClick={() => startMatch(m.id)}
                  >
                    Play this match
                  </PrimaryButton>
                )}
                {inProgress && (
                  <SecondaryButton
                    className="w-full mt-2 text-sm"
                    onClick={() => continueMatch(m.gameId)}
                  >
                    Continue match
                  </SecondaryButton>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {error && <p className="text-sm text-[#EF4444] mt-2">{error}</p>}
    </div>
  );
}
