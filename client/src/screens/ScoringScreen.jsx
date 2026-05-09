import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import Board from '../components/Board.jsx';
import CornholeBurst from '../components/CornholeBurst.jsx';
import { PrimaryButton, SecondaryButton, DangerButton, GhostButton } from '../components/Button.jsx';
import { BAG_HEX } from '../constants/colours.js';
import { fireCornholeBurst } from '../lib/celebration.js';

const THROWS_PER_ROUND = 8;

function isTwoVsTwo(game) {
  return game.players.length === 4;
}

function activeRound(game) {
  if (!game.rounds || game.rounds.length === 0) return null;
  return game.rounds.reduce((max, r) => (r.roundNumber > max.roundNumber ? r : max), game.rounds[0]);
}

function activePlayers(game, round) {
  if (!round) return [];
  if (!isTwoVsTwo(game)) return game.players;
  return game.players.filter((gp) => gp.position === round.throwingPair);
}

function nextThrower(game, round) {
  if (!round) return null;
  const active = activePlayers(game, round);
  const t1 = active.find((gp) => gp.team === 1);
  const t2 = active.find((gp) => gp.team === 2);
  const throwsSoFar = round.bagThrows.length;
  if (throwsSoFar >= THROWS_PER_ROUND) return null;
  const isStartingTeamTurn = throwsSoFar % 2 === 0;
  const teamTurn = isStartingTeamTurn ? round.startingTeam : round.startingTeam === 1 ? 2 : 1;
  return teamTurn === 1 ? t1 : t2;
}

export default function ScoringScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [game, setGame] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showQuit, setShowQuit] = useState(false);
  const [cornholeBurst, setCornholeBurst] = useState(null);

  function celebrateCornhole(colourHex) {
    setCornholeBurst({ id: Date.now(), color: colourHex });
    fireCornholeBurst(colourHex);
  }

  useEffect(() => {
    if (!cornholeBurst) return;
    const t = setTimeout(() => setCornholeBurst(null), 1500);
    return () => clearTimeout(t);
  }, [cornholeBurst]);

  const load = useCallback(async () => {
    try {
      const { game } = await api(`/api/games/${id}`);
      setGame(game);
      if (game.status === 'COMPLETED') {
        navigate(`/game/${id}/over`, { replace: true });
      }
    } catch (err) {
      setError(err.message);
    }
  }, [id, navigate]);

  useEffect(() => {
    load();
    function onFlushed() {
      load();
    }
    window.addEventListener('pt-sync-flushed', onFlushed);
    return () => window.removeEventListener('pt-sync-flushed', onFlushed);
  }, [load]);

  const round = useMemo(() => (game ? activeRound(game) : null), [game]);
  const thrower = useMemo(() => (game && round ? nextThrower(game, round) : null), [game, round]);
  const allEightThrown = round ? round.bagThrows.length >= THROWS_PER_ROUND : false;

  const team1 = game ? game.players.filter((gp) => gp.team === 1) : [];
  const team2 = game ? game.players.filter((gp) => gp.team === 2) : [];
  const team1Hex = game ? BAG_HEX[game.team1Colour] : '#FFD700';
  const team2Hex = game ? BAG_HEX[game.team2Colour] : '#EF4444';

  const teamByPlayer = useMemo(() => {
    if (!game) return {};
    const m = {};
    for (const gp of game.players) m[gp.playerId] = gp.team;
    return m;
  }, [game]);

  const bags = useMemo(() => {
    if (!round) return [];
    return round.bagThrows.map((t, i) => ({
      id: t.id,
      boardX: t.boardX,
      boardY: t.boardY,
      result: t.result,
      colour: teamByPlayer[t.playerId] === 1 ? game.team1Colour : game.team2Colour,
      label: String(i + 1),
    }));
  }, [round, teamByPlayer, game]);

  async function placeBag(x, y) {
    if (busy || !thrower || allEightThrown) return;
    setBusy(true);
    const throwerTeam = teamByPlayer[thrower.playerId];
    const throwerHex = throwerTeam === 1 ? team1Hex : team2Hex;
    try {
      const { round: updated, totals } = await api('/api/throws', {
        method: 'POST',
        body: { gameId: game.id, roundId: round.id, playerId: thrower.playerId, boardX: x, boardY: y },
      });
      setGame((prev) => mergeRound(prev, updated, totals));
      const last = updated.bagThrows[updated.bagThrows.length - 1];
      if (last?.result === 'CORNHOLE') celebrateCornhole(throwerHex);
    } catch (err) {
      if (!err.queued) setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function moveBag(bagId, x, y) {
    if (busy) return;
    setBusy(true);
    const prev = round.bagThrows.find((t) => t.id === bagId);
    const wasCornhole = prev?.result === 'CORNHOLE';
    const movedTeam = prev ? teamByPlayer[prev.playerId] : null;
    const movedHex = movedTeam === 1 ? team1Hex : team2Hex;
    try {
      const { round: updated, totals } = await api(`/api/throws/${bagId}`, {
        method: 'PUT',
        body: { boardX: x, boardY: y },
      });
      setGame((p) => mergeRound(p, updated, totals));
      const moved = updated.bagThrows.find((t) => t.id === bagId);
      if (moved?.result === 'CORNHOLE' && !wasCornhole) celebrateCornhole(movedHex);
    } catch (err) {
      if (!err.queued) setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function undo() {
    if (busy || !round || round.bagThrows.length === 0) return;
    const last = round.bagThrows[round.bagThrows.length - 1];
    setBusy(true);
    try {
      const { round: updated, totals } = await api(`/api/throws/${last.id}`, { method: 'DELETE' });
      setGame((prev) => mergeRound(prev, updated, totals));
    } catch (err) {
      if (!err.queued) setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function confirmRound() {
    if (busy || !round) return;
    setBusy(true);
    try {
      const { game: refreshed, winningTeam } = await api(`/api/rounds/${round.id}/complete`, {
        method: 'PUT',
      });
      setGame(refreshed);
      if (winningTeam) {
        navigate(`/game/${id}/over`, { replace: true });
      }
    } catch (err) {
      if (!err.queued) setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function quitGame() {
    setBusy(true);
    try {
      await api(`/api/games/${id}/status`, { method: 'PUT', body: { status: 'ABANDONED' } });
      navigate('/', { replace: true });
    } catch (err) {
      if (!err.queued) setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (error && !game) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6">
        <p className="text-[#EF4444]">{error}</p>
        <GhostButton onClick={() => navigate('/')}>Back home</GhostButton>
      </div>
    );
  }
  if (!game || !round) {
    return <div className="min-h-screen flex items-center justify-center text-[#FAEEDA]/70">Loading...</div>;
  }

  const throwerPlayer = thrower ? game.players.find((gp) => gp.playerId === thrower.playerId)?.player : null;

  return (
    <div className="min-h-screen flex flex-col px-3 py-4 max-w-md lg:max-w-4xl mx-auto pb-20">
      <header className="grid grid-cols-2 gap-2 mb-3">
        <ScoreCard
          label={team1.map((gp) => gp.player.username).join(' & ')}
          score={game.team1Score}
          colour={team1Hex}
          highlight={thrower && teamByPlayer[thrower.playerId] === 1}
        />
        <ScoreCard
          label={team2.map((gp) => gp.player.username).join(' & ')}
          score={game.team2Score}
          colour={team2Hex}
          highlight={thrower && teamByPlayer[thrower.playerId] === 2}
        />
      </header>

      <div className="text-center mb-2">
        <p className="text-xs uppercase tracking-wider text-[#FAEEDA]/60">
          Round {round.roundNumber} &middot; Throw {Math.min(round.bagThrows.length + (allEightThrown ? 0 : 1), THROWS_PER_ROUND)} of {THROWS_PER_ROUND} &middot; Target {game.targetScore}
        </p>
        {throwerPlayer ? (
          <p className="text-base font-semibold mt-0.5">
            <span
              className="inline-block w-3 h-3 rounded-full mr-2 align-middle"
              style={{ background: teamByPlayer[thrower.playerId] === 1 ? team1Hex : team2Hex }}
            />
            {throwerPlayer.username}
          </p>
        ) : (
          <p className="text-base font-semibold mt-0.5 text-[#FAEEDA]/80">All 8 bags thrown</p>
        )}
      </div>

      <div className="flex items-center justify-center gap-2 mb-2 px-3 py-2 rounded-xl bg-[#082F58]/60 border border-[#FAEEDA]/15">
        <span className="text-xs uppercase tracking-wider text-[#FAEEDA]/50">Round</span>
        <span className="text-sm font-semibold" style={{ color: team1Hex }}>
          Team 1: {round.team1RoundScore}pts
        </span>
        <span className="text-[#FAEEDA]/40">|</span>
        <span className="text-sm font-semibold" style={{ color: team2Hex }}>
          Team 2: {round.team2RoundScore}pts
        </span>
      </div>

      <div className="lg:grid lg:grid-cols-[minmax(0,420px)_1fr] lg:gap-6 lg:items-start">
        <Board bags={bags} onPlace={placeBag} onMove={moveBag} disabled={busy || !thrower} />

        <div className="flex flex-col">
          <RoundPanel
            round={round}
            game={game}
            team1Hex={team1Hex}
            team2Hex={team2Hex}
            teamByPlayer={teamByPlayer}
            allEightThrown={allEightThrown}
            busy={busy}
            onConfirm={confirmRound}
          />

          <div className="mt-3">
            <SecondaryButton
              className="w-full"
              disabled={busy || round.bagThrows.length === 0}
              onClick={undo}
            >
              Undo last
            </SecondaryButton>
          </div>

          <div className="mt-6 flex justify-center gap-2">
            <GhostButton
              onClick={() => {
                const url = `${window.location.origin}/spectate/${id}`;
                if (navigator.share) {
                  navigator.share({ title: 'PT Cornhole', text: 'Watch live', url }).catch(() => {});
                } else if (navigator.clipboard) {
                  navigator.clipboard.writeText(url);
                  alert('Spectator link copied');
                } else {
                  prompt('Spectator link', url);
                }
              }}
            >
              Spectator link
            </GhostButton>
            <DangerButton onClick={() => setShowQuit(true)}>Quit game</DangerButton>
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-[#EF4444] text-center mt-2">{error}</p>}

      <CornholeBurst active={cornholeBurst?.id} color={cornholeBurst?.color} />

      {showQuit && (
        <Modal>
          <h3 className="text-lg font-semibold mb-2">End this game?</h3>
          <p className="text-sm text-[#FAEEDA]/80 mb-4">
            The game will be marked as abandoned. This cannot be undone.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <SecondaryButton onClick={() => setShowQuit(false)}>Keep playing</SecondaryButton>
            <DangerButton onClick={quitGame}>Quit</DangerButton>
          </div>
        </Modal>
      )}

    </div>
  );
}

function mergeRound(game, updatedRound, totals) {
  if (!game) return game;
  const rounds = game.rounds.map((r) => (r.id === updatedRound.id ? { ...r, ...updatedRound } : r));
  return {
    ...game,
    rounds,
    team1Score: totals?.team1Score ?? game.team1Score,
    team2Score: totals?.team2Score ?? game.team2Score,
  };
}

function ScoreCard({ label, score, colour, highlight }) {
  return (
    <div
      className={
        'rounded-2xl p-3 border ' +
        (highlight ? 'border-[#FAEEDA]' : 'border-[#FAEEDA]/20')
      }
      style={{ background: 'rgba(8, 47, 88, 0.7)' }}
    >
      <div className="flex items-center gap-2">
        <span className="w-3 h-3 rounded-full" style={{ background: colour }} />
        <span className="text-xs uppercase tracking-wider text-[#FAEEDA]/70 truncate">{label}</span>
      </div>
      <div className="text-3xl font-bold mt-1" style={{ color: colour }}>
        {score}
      </div>
    </div>
  );
}

function RoundPanel({ round, game, team1Hex, team2Hex, teamByPlayer, allEightThrown, busy, onConfirm }) {
  const titleClass = allEightThrown
    ? 'text-base font-semibold text-[#FAEEDA]'
    : 'text-xs uppercase tracking-wider text-[#FAEEDA]/60';

  return (
    <div
      className={
        'mt-3 p-3 rounded-2xl bg-[#082F58] border ' +
        (allEightThrown ? 'border-[#FAEEDA]/40' : 'border-[#FAEEDA]/15')
      }
    >
      <p className={titleClass + ' mb-2'}>
        {allEightThrown ? 'Round complete' : 'This round'}
      </p>

      {allEightThrown ? (
        <BagByBagList
          round={round}
          game={game}
          teamByPlayer={teamByPlayer}
          team1Hex={team1Hex}
          team2Hex={team2Hex}
        />
      ) : (
        <PerTeamLive
          round={round}
          game={game}
          teamByPlayer={teamByPlayer}
          team1Hex={team1Hex}
          team2Hex={team2Hex}
        />
      )}

      <hr className="border-[#FAEEDA]/15 my-2" />
      <p className="text-sm">
        Round &mdash; T1: <strong>{round.team1RoundScore}</strong> &middot; T2:{' '}
        <strong>{round.team2RoundScore}</strong>
      </p>
      <p className="text-sm font-semibold">
        {round.netPoints === 0
          ? 'Cancellation: tied (no points)'
          : `Cancellation: +${round.netPoints} to Team ${round.scoringTeam}`}
      </p>

      {allEightThrown && (
        <PrimaryButton className="w-full mt-3" disabled={busy} onClick={onConfirm}>
          {busy ? 'Confirming...' : '✓ Confirm round'}
        </PrimaryButton>
      )}
    </div>
  );
}

function PerTeamLive({ round, game, teamByPlayer, team1Hex, team2Hex }) {
  const t1 = round.bagThrows.filter((t) => teamByPlayer[t.playerId] === 1);
  const t2 = round.bagThrows.filter((t) => teamByPlayer[t.playerId] === 2);
  function renderResults(throws, hex) {
    const map = throws.map((t) => (t.result === 'CORNHOLE' ? '3' : t.result === 'BOARD' ? '1' : '0'));
    return (
      <span className="text-sm">
        <span className="inline-block w-2.5 h-2.5 rounded-full mr-1.5 align-middle" style={{ background: hex }} />
        {map.length === 0 ? <em className="text-[#FAEEDA]/50">no throws</em> : map.join(' · ')}
      </span>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      {renderResults(t1, team1Hex)}
      {renderResults(t2, team2Hex)}
    </div>
  );
}

function BagByBagList({ round, game, teamByPlayer, team1Hex, team2Hex }) {
  return (
    <ol className="text-sm space-y-1">
      {round.bagThrows.map((t, i) => {
        const team = teamByPlayer[t.playerId];
        const hex = team === 1 ? team1Hex : team2Hex;
        const playerName = game.players.find((gp) => gp.playerId === t.playerId)?.player?.username || 'Player';
        const label =
          t.result === 'CORNHOLE' ? 'Cornhole (3)' : t.result === 'BOARD' ? 'Board (1)' : 'Off (0)';
        const labelColour =
          t.result === 'CORNHOLE' ? '#FAEEDA' : t.result === 'BOARD' ? '#FAEEDA' : '#FAEEDA';
        const labelOpacity = t.result === 'OFF' ? 0.55 : 1;
        return (
          <li key={t.id} className="flex items-center gap-2">
            <span className="w-5 text-right text-[#FAEEDA]/50 text-xs">{i + 1}.</span>
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: hex }} />
            <span className="flex-1 truncate">{playerName}</span>
            <span style={{ color: labelColour, opacity: labelOpacity }}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

function Modal({ children }) {
  return (
    <div className="fixed inset-0 bg-black/70 z-40 flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl bg-[#0C447C] border border-[#FAEEDA]/20 p-5">
        {children}
      </div>
    </div>
  );
}
