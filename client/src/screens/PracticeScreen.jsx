import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import Board from '../components/Board.jsx';
import Heatmap, { HeatmapLegend } from '../components/Heatmap.jsx';
import CornholeBurst from '../components/CornholeBurst.jsx';
import { PrimaryButton, SecondaryButton, DangerButton, GhostButton } from '../components/Button.jsx';
import { BAG_HEX } from '../constants/colours.js';
import { classifyThrow } from '../constants/board.js';
import { fireCornholeBurst } from '../lib/celebration.js';

export default function PracticeScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [game, setGame] = useState(null);
  const [pending, setPending] = useState([]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showEnd, setShowEnd] = useState(false);
  const [cornholeBurst, setCornholeBurst] = useState(null);
  const [showHeatmap, setShowHeatmap] = useState(false);

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
    } catch (err) {
      setError(err.message);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const players = game ? game.players : [];
  const throwsPerSet = game ? game.practiceThrowsPerSet : 4;
  const isTwoPlayer = players.length === 2;
  const totalSlots = throwsPerSet * players.length;

  function colourFor(playerId) {
    return players.find((gp) => gp.playerId === playerId)?.bagColour || 'YELLOW';
  }

  function nextPlayer() {
    if (!players.length) return null;
    if (!isTwoPlayer) return players[0];
    const counts = players.map((gp) => ({
      gp,
      count: pending.filter((t) => t.playerId === gp.playerId).length,
    }));
    if (pending.length === 0) return players[0];
    const lastPid = pending[pending.length - 1].playerId;
    const other = players.find((gp) => gp.playerId !== lastPid);
    if (counts.find((c) => c.gp.playerId === other.playerId).count < throwsPerSet) return other;
    return counts.find((c) => c.count < throwsPerSet)?.gp || null;
  }

  const upcoming = nextPlayer();

  function placeBag(x, y) {
    if (!upcoming) return;
    if (pending.length >= totalSlots) return;
    setPending((p) => [
      ...p,
      {
        id: `pending-${p.length}-${Date.now()}`,
        playerId: upcoming.playerId,
        boardX: x,
        boardY: y,
      },
    ]);
    if (classifyThrow(x, y).result === 'CORNHOLE') {
      celebrateCornhole(BAG_HEX[colourFor(upcoming.playerId)]);
    }
  }

  function moveBag(bagId, x, y) {
    const prev = pending.find((t) => t.id === bagId);
    const wasCornhole = prev ? classifyThrow(prev.boardX, prev.boardY).result === 'CORNHOLE' : false;
    setPending((p) => p.map((t) => (t.id === bagId ? { ...t, boardX: x, boardY: y } : t)));
    if (!wasCornhole && classifyThrow(x, y).result === 'CORNHOLE' && prev) {
      celebrateCornhole(BAG_HEX[colourFor(prev.playerId)]);
    }
  }

  function undo() {
    setPending((p) => p.slice(0, -1));
  }

  async function bank() {
    if (pending.length === 0 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const body = {
        throws: pending.map((t) => ({ playerId: t.playerId, boardX: t.boardX, boardY: t.boardY })),
        tag: game.practiceTag,
      };
      await api(`/api/games/${id}/sets`, { method: 'POST', body });
      setPending([]);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function endPractice() {
    setBusy(true);
    try {
      await api(`/api/games/${id}/status`, { method: 'PUT', body: { status: 'COMPLETED' } });
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const bags = pending.map((t, i) => ({
    id: t.id,
    boardX: t.boardX,
    boardY: t.boardY,
    result: classifyThrow(t.boardX, t.boardY).result,
    colour: colourFor(t.playerId),
    label: String(i + 1),
  }));

  const stats = useMemo(() => computeStats(game), [game]);

  if (error && !game) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6">
        <p className="text-[#EF4444]">{error}</p>
        <GhostButton onClick={() => navigate('/')}>Back home</GhostButton>
      </div>
    );
  }
  if (!game) {
    return <div className="min-h-screen flex items-center justify-center text-[#FAEEDA]/70">Loading...</div>;
  }

  const upcomingPlayer = upcoming ? players.find((gp) => gp.playerId === upcoming.playerId)?.player : null;

  return (
    <div className="min-h-screen flex flex-col px-3 py-4 max-w-md mx-auto pb-20">
      <header className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Practice</h1>
          {game.practiceTag && (
            <p className="text-xs text-[#FAEEDA]/60">Tag: {game.practiceTag}</p>
          )}
        </div>
        <GhostButton onClick={() => setShowEnd(true)}>End practice</GhostButton>
      </header>

      <div className="text-center mb-2">
        <p className="text-xs uppercase tracking-wider text-[#FAEEDA]/60">
          Pending throw {Math.min(pending.length + 1, totalSlots)} of {totalSlots}
        </p>
        {upcomingPlayer ? (
          <p className="text-base font-semibold mt-0.5">
            <span
              className="inline-block w-3 h-3 rounded-full mr-2 align-middle"
              style={{ background: BAG_HEX[colourFor(upcoming.playerId)] }}
            />
            {upcomingPlayer.username}
          </p>
        ) : (
          <p className="text-base font-semibold mt-0.5 text-[#FAEEDA]/80">Set ready, tap Bank</p>
        )}
      </div>

      {showHeatmap ? (
        <SessionHeatmap game={game} />
      ) : (
        <Board bags={bags} onPlace={placeBag} onMove={moveBag} disabled={busy} />
      )}

      <div className="mt-2 flex justify-center">
        <button
          onClick={() => setShowHeatmap((s) => !s)}
          className="text-xs uppercase tracking-wider text-[#FAEEDA]/70 underline underline-offset-4"
        >
          {showHeatmap ? '← Back to board' : 'Show session heatmap'}
        </button>
      </div>

      <div className="mt-3 p-3 rounded-2xl bg-[#082F58] border border-[#FAEEDA]/15 text-sm">
        <p className="text-xs uppercase tracking-wider text-[#FAEEDA]/60 mb-1">This set, live</p>
        <PendingBreakdown pending={pending} players={players} />
      </div>

      <div className="grid grid-cols-2 gap-2 mt-3">
        <SecondaryButton disabled={pending.length === 0 || busy} onClick={undo}>
          Undo last
        </SecondaryButton>
        <PrimaryButton disabled={pending.length === 0 || busy} onClick={bank}>
          Bank
        </PrimaryButton>
      </div>

      {stats && <StatsBlock stats={stats} players={players} />}

      {error && <p className="text-sm text-[#EF4444] text-center mt-2">{error}</p>}

      <CornholeBurst active={cornholeBurst?.id} color={cornholeBurst?.color} />

      {showEnd && (
        <Modal>
          <h3 className="text-lg font-semibold mb-2">End practice?</h3>
          <p className="text-sm text-[#FAEEDA]/80 mb-4">
            The session will be saved with all banked sets. Pending throws are discarded.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <SecondaryButton onClick={() => setShowEnd(false)}>Keep practising</SecondaryButton>
            <DangerButton onClick={endPractice}>End</DangerButton>
          </div>
        </Modal>
      )}
    </div>
  );
}

function SessionHeatmap({ game }) {
  const throws = (game.practiceSets || [])
    .flatMap((s) => s.bagThrows)
    .map((t) => ({ x: t.boardX, y: t.boardY, result: t.result }));
  return (
    <div>
      <Heatmap throws={throws} />
      <HeatmapLegend />
      <p className="text-xs text-[#FAEEDA]/60 text-center mt-1">
        Updates after each banked set ({throws.length} throws so far)
      </p>
    </div>
  );
}

function PendingBreakdown({ pending, players }) {
  if (pending.length === 0) return <em className="text-[#FAEEDA]/50">Tap board to place a bag.</em>;
  const tally = {};
  for (const p of pending) {
    if (!tally[p.playerId]) tally[p.playerId] = [];
    const c = classifyThrow(p.boardX, p.boardY);
    tally[p.playerId].push(c);
  }
  return (
    <div className="flex flex-col gap-1">
      {players.map((gp) => {
        const list = tally[gp.playerId] || [];
        return (
          <div key={gp.playerId} className="text-sm">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full mr-1.5 align-middle"
              style={{ background: BAG_HEX[gp.bagColour] }}
            />
            <span>{gp.player?.username || 'Player'}: </span>
            <span className="text-[#FAEEDA]/80">
              {list.length === 0
                ? 'no throws'
                : list.map((c) => (c.result === 'CORNHOLE' ? '3' : c.result === 'BOARD' ? '1' : '0')).join(' · ')}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function computeStats(game) {
  if (!game) return null;
  const perPlayer = {};
  for (const gp of game.players) {
    perPlayer[gp.playerId] = { username: gp.player.username, sets: 0, total: 0, cornhole: 0, board: 0, off: 0 };
  }
  for (const set of game.practiceSets) {
    if (perPlayer[set.playerId]) perPlayer[set.playerId].sets += 1;
    for (const t of set.bagThrows) {
      const p = perPlayer[t.playerId];
      if (!p) continue;
      p.total += 1;
      if (t.result === 'CORNHOLE') p.cornhole += 1;
      else if (t.result === 'BOARD') p.board += 1;
      else p.off += 1;
    }
  }
  return perPlayer;
}

function StatsBlock({ stats, players }) {
  return (
    <div className="mt-3 p-3 rounded-2xl bg-[#082F58] border border-[#FAEEDA]/15 text-sm">
      <p className="text-xs uppercase tracking-wider text-[#FAEEDA]/60 mb-1">Session stats, banked</p>
      {players.map((gp) => {
        const s = stats[gp.playerId];
        if (!s) return null;
        const pct = (n) => (s.total ? `${Math.round((n / s.total) * 100)}%` : '0%');
        return (
          <div key={gp.playerId} className="mt-1">
            <p>
              <span
                className="inline-block w-2.5 h-2.5 rounded-full mr-1.5 align-middle"
                style={{ background: BAG_HEX[gp.bagColour] }}
              />
              <strong>{s.username}</strong> &middot; Sets: {s.sets} &middot; Throws: {s.total}
            </p>
            <p className="text-[#FAEEDA]/80 text-xs">
              Cornholes: {s.cornhole} ({pct(s.cornhole)}) &middot; Board: {s.board} ({pct(s.board)}) &middot; Off: {s.off} ({pct(s.off)})
            </p>
          </div>
        );
      })}
    </div>
  );
}

function Modal({ children }) {
  return (
    <div className="fixed inset-0 bg-black/70 z-40 flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl bg-[#0C447C] border border-[#FAEEDA]/20 p-5">{children}</div>
    </div>
  );
}
