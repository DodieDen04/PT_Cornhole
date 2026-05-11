import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import Board from '../components/Board.jsx';
import Heatmap, { HeatmapLegend } from '../components/Heatmap.jsx';
import CornholeBurst from '../components/CornholeBurst.jsx';
import PTLogo from '../components/PTLogo.jsx';
import DragTip from '../components/DragTip.jsx';
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
  const [lastBankedSet, setLastBankedSet] = useState(null);

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
    const snapshot = pending.map((t) => ({
      ...t,
      result: classifyThrow(t.boardX, t.boardY).result,
    }));
    try {
      const body = {
        throws: pending.map((t) => ({ playerId: t.playerId, boardX: t.boardX, boardY: t.boardY })),
        tag: game.practiceTag,
      };
      await api(`/api/games/${id}/sets`, { method: 'POST', body });
      setPending([]);
      await load();
      setLastBankedSet(snapshot);
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
  const sessionThrows = useMemo(() => {
    if (!game) return [];
    return (game.practiceSets || [])
      .flatMap((s) => s.bagThrows)
      .map((t) => ({ x: t.boardX, y: t.boardY, result: t.result }));
  }, [game]);

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
  const upcomingColourHex = upcoming ? BAG_HEX[colourFor(upcoming.playerId)] : '#FFD700';

  const pendingByPlayer = {};
  for (const gp of players) pendingByPlayer[gp.playerId] = 0;
  for (const p of pending) {
    if (pendingByPlayer[p.playerId] != null) pendingByPlayer[p.playerId] += 1;
  }

  return (
    <div
      className="h-dvh flex flex-col px-3 max-w-md lg:max-w-4xl mx-auto"
      style={{
        paddingTop: 'max(0.5rem, env(safe-area-inset-top))',
        paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))',
      }}
    >
      <header className="flex items-center justify-between mb-2">
        <PTLogo className="h-7" />
        <div className="text-center flex-1 mx-2">
          <p className="text-sm uppercase tracking-wider text-[#FAEEDA]/70">Practice</p>
          {game.practiceTag && (
            <p className="text-[10px] text-[#FAEEDA]/60 truncate">{game.practiceTag}</p>
          )}
        </div>
        <GhostButton onClick={() => setShowEnd(true)}>End</GhostButton>
      </header>

      <div
        className={
          'mb-2 ' + (isTwoPlayer ? 'grid grid-cols-2 gap-2' : '')
        }
      >
        {players.map((gp) => (
          <PracticeCard
            key={gp.playerId}
            label={gp.player.username}
            colour={BAG_HEX[gp.bagColour]}
            thrown={pendingByPlayer[gp.playerId] || 0}
            total={throwsPerSet}
            highlight={upcoming?.playerId === gp.playerId}
          />
        ))}
      </div>

      <div className="text-center mb-2 min-h-[24px]">
        {upcomingPlayer ? (
          <p className="text-sm">
            <span className="text-[#FAEEDA]/60">Now throwing: </span>
            <span className="font-semibold">{upcomingPlayer.username}</span>
            <span
              className="inline-block w-3 h-3 rounded-full ml-2 align-middle"
              style={{ background: upcomingColourHex }}
            />
          </p>
        ) : (
          <p className="text-sm font-semibold text-[#FAEEDA]/80">Set ready, tap Bank</p>
        )}
      </div>

      <DragTip />

      <div className="flex-1 min-h-0 flex items-center justify-center">
        <Board bags={bags} onPlace={placeBag} onMove={moveBag} disabled={busy} />
      </div>

      {error && <p className="text-xs text-[#EF4444] text-center mt-1">{error}</p>}

      <div className="grid grid-cols-2 gap-2 pt-2">
        <SecondaryButton disabled={pending.length === 0 || busy} onClick={undo}>
          Undo last
        </SecondaryButton>
        <PrimaryButton disabled={pending.length === 0 || busy} onClick={bank}>
          {busy ? 'Banking...' : 'Bank'}
        </PrimaryButton>
      </div>

      <CornholeBurst active={cornholeBurst?.id} color={cornholeBurst?.color} />

      {lastBankedSet && (
        <BankSetPopup
          set={lastBankedSet}
          players={players}
          stats={stats}
          sessionThrows={sessionThrows}
          onNext={() => setLastBankedSet(null)}
          onEnd={() => {
            setLastBankedSet(null);
            setShowEnd(true);
          }}
        />
      )}

      {showEnd && (
        <Modal>
          <h3 className="text-lg font-semibold mb-2">End practice?</h3>
          <p className="text-sm text-[#FAEEDA]/80 mb-4">
            The session will be saved with all banked sets. Pending throws are discarded.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <SecondaryButton onClick={() => setShowEnd(false)}>Keep practising</SecondaryButton>
            <DangerButton disabled={busy} onClick={endPractice}>
              End
            </DangerButton>
          </div>
        </Modal>
      )}
    </div>
  );
}

function PracticeCard({ label, colour, thrown, total, highlight }) {
  return (
    <div
      className={
        'rounded-2xl px-3 py-2 border ' +
        (highlight ? 'border-[#FAEEDA]' : 'border-[#FAEEDA]/20')
      }
      style={{ background: 'rgba(8, 47, 88, 0.7)' }}
    >
      <div className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: colour }} />
        <span className="text-xs uppercase tracking-wider text-[#FAEEDA]/70 truncate">{label}</span>
      </div>
      <div className="flex gap-1 mt-1.5 flex-wrap">
        {Array.from({ length: total }).map((_, i) => (
          <span
            key={i}
            className="w-2.5 h-2.5 rounded-full border"
            style={{
              background: i < thrown ? colour : 'transparent',
              borderColor: colour,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function BankSetPopup({ set, players, stats, sessionThrows, onNext, onEnd }) {
  const byPlayer = {};
  for (const t of set) {
    if (!byPlayer[t.playerId]) byPlayer[t.playerId] = [];
    byPlayer[t.playerId].push(t);
  }
  const totalSetsBanked =
    stats && Object.values(stats).reduce((m, s) => Math.max(m, s.sets), 0);

  return (
    <div className="fixed inset-0 bg-black/75 z-40 flex items-center justify-center p-4">
      <div
        className="w-full max-w-sm rounded-2xl bg-[#0C447C] border border-[#FAEEDA]/25 p-5 shadow-2xl flex flex-col"
        style={{ maxHeight: 'calc(100dvh - 2rem)' }}
      >
        <h3 className="text-base font-bold text-center mb-3">
          Set {totalSetsBanked || ''} complete
        </h3>

        <div className="overflow-y-auto -mx-1 px-1 mb-3">
          <p className="text-xs uppercase tracking-wider text-[#FAEEDA]/60 mb-1">This set</p>
          <div className="flex flex-col gap-1.5 mb-3">
            {players.map((gp) => {
              const throws = byPlayer[gp.playerId] || [];
              if (throws.length === 0) return null;
              const hex = BAG_HEX[gp.bagColour];
              const labels = throws.map((t) =>
                t.result === 'CORNHOLE' ? 'Cornhole (3)' : t.result === 'BOARD' ? 'Board (1)' : 'Off (0)',
              );
              return (
                <div key={gp.playerId} className="text-sm">
                  <p className="font-semibold mb-0.5">
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full mr-1.5 align-middle"
                      style={{ background: hex }}
                    />
                    {gp.player.username}
                  </p>
                  <ol className="space-y-0.5 pl-5 list-decimal text-[#FAEEDA]/80 text-xs">
                    {labels.map((l, i) => (
                      <li key={i}>{l}</li>
                    ))}
                  </ol>
                </div>
              );
            })}
          </div>

          {stats && (
            <>
              <p className="text-xs uppercase tracking-wider text-[#FAEEDA]/60 mb-1">Session totals</p>
              <div className="flex flex-col gap-1 text-sm mb-3">
                {players.map((gp) => {
                  const s = stats[gp.playerId];
                  if (!s || s.total === 0) return null;
                  const pct = (n) => `${Math.round((n / s.total) * 100)}%`;
                  return (
                    <div key={gp.playerId} className="text-xs">
                      <p>
                        <span
                          className="inline-block w-2.5 h-2.5 rounded-full mr-1.5 align-middle"
                          style={{ background: BAG_HEX[gp.bagColour] }}
                        />
                        <strong>{s.username}</strong>
                        <span className="text-[#FAEEDA]/70">
                          {' '}
                          &middot; {s.sets} set{s.sets === 1 ? '' : 's'} &middot; {s.total} throws
                        </span>
                      </p>
                      <p className="text-[#FAEEDA]/70 pl-4">
                        Cornholes {s.cornhole} ({pct(s.cornhole)}) &middot; Board {s.board} ({pct(s.board)}) &middot;
                        Off {s.off} ({pct(s.off)})
                      </p>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {sessionThrows.length > 0 && (
            <>
              <p className="text-xs uppercase tracking-wider text-[#FAEEDA]/60 mb-1">Session heatmap</p>
              <Heatmap throws={sessionThrows} />
              <HeatmapLegend />
              <p className="text-[10px] text-[#FAEEDA]/50 text-center mt-1">
                {sessionThrows.length} throws so far
              </p>
            </>
          )}
        </div>

        <PrimaryButton className="w-full" onClick={onNext}>
          Next set
        </PrimaryButton>
        <button
          onClick={onEnd}
          className="w-full mt-3 text-xs text-[#FAEEDA]/55 underline underline-offset-4"
        >
          End practice
        </button>
      </div>
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

function Modal({ children }) {
  return (
    <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl bg-[#0C447C] border border-[#FAEEDA]/25 p-5 shadow-2xl">
        {children}
      </div>
    </div>
  );
}
