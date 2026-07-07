import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import Board from '../components/Board.jsx';
import CornholeBurst from '../components/CornholeBurst.jsx';
import PTLogo from '../components/PTLogo.jsx';
import DragTip from '../components/DragTip.jsx';
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
  const { player: me } = useAuth();
  const [game, setGame] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [cornholeBurst, setCornholeBurst] = useState(null);
  const [showEndPopup, setShowEndPopup] = useState(false);
  const [showQuit, setShowQuit] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [remoteHint, setRemoteHint] = useState(null);

  function celebrateCornhole(colourHex) {
    setCornholeBurst({ id: Date.now(), color: colourHex });
    fireCornholeBurst(colourHex);
  }

  useEffect(() => {
    if (!cornholeBurst) return;
    const t = setTimeout(() => setCornholeBurst(null), 1500);
    return () => clearTimeout(t);
  }, [cornholeBurst]);

  useEffect(() => {
    if (!remoteHint) return;
    const t = setTimeout(() => setRemoteHint(null), 2000);
    return () => clearTimeout(t);
  }, [remoteHint]);

  const load = useCallback(async () => {
    try {
      const { game } = await api(`/api/games/${id}`);
      setGame(game);
      if (game.status === 'COMPLETED') {
        navigate(`/game/${id}/over`, { replace: true });
        return;
      }
      const isParticipant = game.players.some((gp) => gp.playerId === me.id);
      if (!isParticipant && game.createdById !== me.id) {
        navigate(`/spectate/${id}`, { replace: true });
      }
    } catch (err) {
      setError(err.message);
    }
  }, [id, navigate, me.id]);

  useEffect(() => {
    load();
    function onFlushed() {
      load();
    }
    window.addEventListener('pt-sync-flushed', onFlushed);
    return () => window.removeEventListener('pt-sync-flushed', onFlushed);
  }, [load]);

  // Live sync: other scorers' phones and this one share the game via the
  // spectate WebSocket. iOS kills sockets when the PWA backgrounds, so
  // reconnect with backoff and refetch on reconnect and on foreground.
  const wsRef = useRef(null);
  useEffect(() => {
    let closed = false;
    let retries = 0;
    let retryTimer = null;

    function connect() {
      if (closed) return;
      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(`${proto}://${window.location.host}/ws/spectate?gameId=${id}`);
      wsRef.current = ws;
      ws.onopen = () => {
        setWsConnected(true);
        if (retries > 0) load();
        retries = 0;
      };
      ws.onclose = () => {
        setWsConnected(false);
        if (closed) return;
        const delay = [1000, 2000, 5000][Math.min(retries, 2)];
        retries += 1;
        retryTimer = setTimeout(connect, delay);
      };
      ws.onerror = () => {};
      ws.onmessage = (e) => {
        let msg;
        try {
          msg = JSON.parse(e.data);
        } catch {
          return;
        }
        if (msg.type !== 'update') return;
        const fromOther = msg.by && msg.by.id !== me.id;
        if (msg.game) {
          setGame(msg.game);
          setShowEndPopup(false);
          if (msg.winningTeam) {
            navigate(`/game/${id}/over`, { replace: true });
          } else if (fromOther) {
            const maxRound = (msg.game.rounds || []).reduce(
              (m, r) => Math.max(m, r.roundNumber),
              1,
            );
            setRemoteHint({
              id: Date.now(),
              text: `Round ${maxRound - 1} confirmed by ${msg.by.username}`,
            });
          }
        } else if (msg.round) {
          setGame((prev) => mergeRound(prev, msg.round, msg.totals));
          if (fromOther) {
            setRemoteHint({ id: Date.now(), text: `${msg.by.username} scored` });
          }
        }
      };
    }

    connect();

    function onVisible() {
      if (document.visibilityState !== 'visible') return;
      load();
      const ws = wsRef.current;
      if (!ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
        clearTimeout(retryTimer);
        connect();
      }
    }
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      closed = true;
      clearTimeout(retryTimer);
      document.removeEventListener('visibilitychange', onVisible);
      wsRef.current?.close();
    };
  }, [id, me.id, load, navigate]);

  // Another phone may have completed the round or filled it a beat before
  // this one acted; refresh instead of surfacing a raw error.
  const handleScoreError = useCallback(
    (err) => {
      if (err.queued) return;
      const msg = err.message || '';
      if (/no longer active|already completed|already has 8|clashed/i.test(msg)) {
        load();
        return;
      }
      setError(msg);
    },
    [load],
  );

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
      handleScoreError(err);
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
      handleScoreError(err);
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
      handleScoreError(err);
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
      setShowEndPopup(false);
      if (winningTeam) {
        navigate(`/game/${id}/over`, { replace: true });
      }
    } catch (err) {
      handleScoreError(err);
    } finally {
      setBusy(false);
    }
  }

  async function popupUndo() {
    await undo();
    setShowEndPopup(false);
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
    return <div className="min-h-screen flex items-center justify-center text-ink/70">Loading...</div>;
  }

  const throwerPlayer = thrower ? game.players.find((gp) => gp.playerId === thrower.playerId)?.player : null;

  const team1Throws = round.bagThrows.filter((t) => teamByPlayer[t.playerId] === 1);
  const team2Throws = round.bagThrows.filter((t) => teamByPlayer[t.playerId] === 2);
  const throwerTeam = thrower ? teamByPlayer[thrower.playerId] : null;
  const throwerHex = throwerTeam === 1 ? team1Hex : throwerTeam === 2 ? team2Hex : null;

  return (
    <div className="h-full flex flex-col px-3 py-2 max-w-md lg:max-w-4xl mx-auto">
      <header className="flex items-center justify-between mb-2">
        <PTLogo className="h-7" />
        <span className="flex items-center gap-2 text-sm uppercase tracking-wider text-ink/70">
          <span
            className={
              'w-2 h-2 rounded-full ' + (wsConnected ? 'bg-[#22C55E]' : 'bg-ink/30')
            }
            title={wsConnected ? 'Live sync on' : 'Reconnecting...'}
          />
          Round {round.roundNumber}
        </span>
      </header>

      {remoteHint && (
        <div
          key={remoteHint.id}
          className="fixed top-2 left-1/2 -translate-x-1/2 z-30 px-3 py-1 rounded-full bg-ink text-page text-xs font-semibold shadow-lg"
          style={{ marginTop: 'env(safe-area-inset-top)' }}
        >
          {remoteHint.text}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 mb-2">
        <TeamCard
          label={team1.map((gp) => gp.player.username).join(' & ')}
          gameScore={game.team1Score}
          roundScore={round.team1RoundScore}
          colour={team1Hex}
          highlight={throwerTeam === 1}
          throws={team1Throws}
        />
        <TeamCard
          label={team2.map((gp) => gp.player.username).join(' & ')}
          gameScore={game.team2Score}
          roundScore={round.team2RoundScore}
          colour={team2Hex}
          highlight={throwerTeam === 2}
          throws={team2Throws}
        />
      </div>

      <div className="text-center mb-2 min-h-[24px]">
        {throwerPlayer ? (
          <p className="text-sm">
            <span className="text-ink/60">Now throwing: </span>
            <span className="font-semibold">{throwerPlayer.username}</span>
            <span
              className="inline-block w-3 h-3 rounded-full ml-2 align-middle"
              style={{ background: throwerHex }}
            />
          </p>
        ) : (
          <p className="text-sm font-semibold text-ink/80">All 8 bags thrown</p>
        )}
      </div>

      <DragTip />

      <div className="flex-1 min-h-0 flex items-center justify-center">
        <Board bags={bags} onPlace={placeBag} onMove={moveBag} disabled={busy} />
      </div>

      {error && <p className="text-xs text-[#EF4444] text-center mt-1">{error}</p>}

      <div className="grid grid-cols-2 gap-2 pt-2">
        <SecondaryButton
          disabled={busy || round.bagThrows.length === 0 || showEndPopup}
          onClick={undo}
        >
          Undo last
        </SecondaryButton>
        <PrimaryButton
          disabled={busy || !allEightThrown}
          onClick={() => setShowEndPopup(true)}
        >
          End round
        </PrimaryButton>
      </div>

      <CornholeBurst active={cornholeBurst?.id} color={cornholeBurst?.color} />

      {showEndPopup && (
        <EndRoundPopup
          round={round}
          game={game}
          team1={team1}
          team2={team2}
          team1Hex={team1Hex}
          team2Hex={team2Hex}
          teamByPlayer={teamByPlayer}
          busy={busy}
          onUndo={popupUndo}
          onConfirm={confirmRound}
          onQuit={() => setShowQuit(true)}
        />
      )}

      {showQuit && (
        <Modal>
          <h3 className="text-lg font-semibold mb-2">End this game?</h3>
          <p className="text-sm text-ink/80 mb-4">
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

function EndRoundPopup({
  round,
  game,
  team1,
  team2,
  team1Hex,
  team2Hex,
  teamByPlayer,
  busy,
  onUndo,
  onConfirm,
  onQuit,
}) {
  const projectedT1 = game.team1Score + (round.scoringTeam === 1 ? round.netPoints : 0);
  const projectedT2 = game.team2Score + (round.scoringTeam === 2 ? round.netPoints : 0);
  const winningTeam =
    projectedT1 >= game.targetScore ? 1 : projectedT2 >= game.targetScore ? 2 : null;
  const team1Names = team1.map((gp) => gp.player.username).join(' & ');
  const team2Names = team2.map((gp) => gp.player.username).join(' & ');

  return (
    <div className="fixed inset-0 bg-black/75 z-40 flex items-center justify-center p-4">
      <div
        className="w-full max-w-sm rounded-2xl bg-surface-2 border border-ink/25 p-5 shadow-2xl flex flex-col"
        style={{ maxHeight: 'calc(100dvh - 2rem)' }}
      >
        <h3 className="text-base font-bold text-center mb-3">
          {winningTeam ? `Team ${winningTeam} wins!` : `Round ${round.roundNumber} complete`}
        </h3>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <PopupScore
            label={team1Names}
            score={projectedT1}
            colour={team1Hex}
            winner={winningTeam === 1}
          />
          <PopupScore
            label={team2Names}
            score={projectedT2}
            colour={team2Hex}
            winner={winningTeam === 2}
          />
        </div>

        <div className="text-center text-sm mb-3">
          <p className="text-xs uppercase tracking-wider text-ink/60 mb-1">This round</p>
          <p>
            <span style={{ color: team1Hex }}>T1: {round.team1RoundScore}</span>
            <span className="text-ink/40 mx-2">|</span>
            <span style={{ color: team2Hex }}>T2: {round.team2RoundScore}</span>
          </p>
          <p className="font-semibold mt-0.5">
            {round.netPoints === 0
              ? '= Tied (no points)'
              : `= +${round.netPoints} to Team ${round.scoringTeam}`}
          </p>
        </div>

        <p className="text-xs uppercase tracking-wider text-ink/60 mb-1">Bag details</p>
        <ol className="text-sm space-y-1 mb-4 overflow-y-auto" style={{ maxHeight: '32vh' }}>
          {round.bagThrows.map((t, i) => {
            const team = teamByPlayer[t.playerId];
            const hex = team === 1 ? team1Hex : team2Hex;
            const playerName =
              game.players.find((gp) => gp.playerId === t.playerId)?.player?.username || 'Player';
            const label =
              t.result === 'CORNHOLE'
                ? 'Cornhole (3)'
                : t.result === 'BOARD'
                ? 'Board (1)'
                : 'Off (0)';
            const dim = t.result === 'OFF' ? 0.55 : 1;
            return (
              <li key={t.id} className="flex items-center gap-2">
                <span className="w-5 text-right text-ink/50 text-xs">{i + 1}.</span>
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: hex }} />
                <span className="flex-1 truncate">{playerName}</span>
                <span style={{ opacity: dim }}>{label}</span>
              </li>
            );
          })}
        </ol>

        {winningTeam ? (
          <PrimaryButton className="w-full" disabled={busy} onClick={onConfirm}>
            {busy ? 'Finishing...' : 'Finish game'}
          </PrimaryButton>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <SecondaryButton disabled={busy} onClick={onUndo}>
              Undo last
            </SecondaryButton>
            <PrimaryButton disabled={busy} onClick={onConfirm}>
              {busy ? 'Saving...' : 'Next round'}
            </PrimaryButton>
          </div>
        )}

        <button
          onClick={onQuit}
          disabled={busy}
          className="w-full mt-3 text-xs text-ink/55 underline underline-offset-4 disabled:opacity-50"
        >
          Quit game
        </button>
      </div>
    </div>
  );
}

function PopupScore({ label, score, colour, winner }) {
  return (
    <div
      className={
        'rounded-xl px-3 py-2 border bg-surface ' + (winner ? 'border-ink' : 'border-ink/20')
      }
      style={{
        boxShadow: winner ? `0 0 14px ${colour}55` : undefined,
      }}
    >
      <div className="flex items-center justify-center gap-1.5">
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: colour }} />
        <span className="text-[10px] uppercase tracking-wider text-ink/70 truncate">
          {label}
        </span>
      </div>
      <div className="text-2xl font-black mt-0.5 text-center" style={{ color: colour }}>
        {score}
      </div>
    </div>
  );
}

function Modal({ children }) {
  return (
    <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl bg-surface-2 border border-ink/25 p-5 shadow-2xl">
        {children}
      </div>
    </div>
  );
}

function TeamCard({ label, gameScore, roundScore, colour, highlight, throws }) {
  return (
    <div
      className={
        'rounded-2xl px-3 py-2 border bg-surface ' +
        (highlight ? 'border-ink' : 'border-ink/20')
      }
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm italic text-ink/70 leading-none">({roundScore})</span>
        <span
          className="text-3xl sm:text-4xl font-black leading-none"
          style={{ color: colour }}
        >
          {gameScore}
        </span>
      </div>
      <div className="flex items-center justify-center gap-1.5 mt-1">
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: colour }} />
        <span className="text-[10px] uppercase tracking-wider text-ink/70 truncate">
          {label}
        </span>
      </div>
      <div className="flex items-center justify-center gap-1.5 mt-1">
        {[0, 1, 2, 3].map((i) => (
          <ThrowIndicator key={i} colour={colour} result={throws[i]?.result} />
        ))}
      </div>
    </div>
  );
}

function ThrowIndicator({ colour, result }) {
  const base = 'inline-flex items-center justify-center w-3.5 h-3.5 rounded-full';
  if (!result) {
    return <span className={base + ' border-2'} style={{ borderColor: colour }} />;
  }
  if (result === 'BOARD') {
    return <span className={base} style={{ background: colour }} />;
  }
  if (result === 'CORNHOLE') {
    return (
      <span className={base} style={{ background: colour }}>
        <span className="w-1.5 h-1.5 rounded-full bg-white" />
      </span>
    );
  }
  return (
    <span className={base} style={{ background: colour }}>
      <span
        className="text-[10px] font-black leading-none"
        style={{ color: '#7F1D1D', textShadow: '0 0 2px white, 0 0 2px white' }}
      >
        ✕
      </span>
    </span>
  );
}
