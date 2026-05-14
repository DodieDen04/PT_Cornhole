import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { GhostButton } from '../components/Button.jsx';
import Heatmap, { HeatmapLegend } from '../components/Heatmap.jsx';
import { BAG_HEX } from '../constants/colours.js';

export default function PracticeDetailScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [game, setGame] = useState(null);
  const [filterPlayerId, setFilterPlayerId] = useState(null);

  useEffect(() => {
    api(`/api/games/${id}`).then((d) => setGame(d.game)).catch(() => {});
  }, [id]);

  const allThrows = useMemo(() => {
    if (!game) return [];
    return game.practiceSets.flatMap((s) => s.bagThrows);
  }, [game]);

  const filteredThrows = useMemo(() => {
    if (!filterPlayerId) return allThrows.map((t) => ({ x: t.boardX, y: t.boardY, result: t.result }));
    return allThrows
      .filter((t) => t.playerId === filterPlayerId)
      .map((t) => ({ x: t.boardX, y: t.boardY, result: t.result }));
  }, [allThrows, filterPlayerId]);

  if (!game) {
    return <div className="min-h-screen flex items-center justify-center text-ink/70">Loading...</div>;
  }

  const date = new Date(game.createdAt).toLocaleString();
  const players = game.players;

  const setsByPlayer = {};
  for (const s of game.practiceSets) {
    if (!setsByPlayer[s.playerId]) setsByPlayer[s.playerId] = [];
    setsByPlayer[s.playerId].push(s);
  }

  return (
    <div className="min-h-screen px-5 py-6 max-w-md mx-auto pb-12">
      <header className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-ink/60">Practice session</p>
          <h1 className="text-xl font-bold tracking-tight">{date}</h1>
          {game.practiceTag && (
            <p className="text-xs text-ink/70">Tag: {game.practiceTag}</p>
          )}
        </div>
        <GhostButton onClick={() => navigate('/history')}>Back</GhostButton>
      </header>

      <section className="mb-5">
        <p className="text-xs uppercase tracking-wider text-ink/60 mb-2">
          Heatmap{filterPlayerId ? '' : ' (all players)'}
        </p>
        {players.length > 1 && (
          <div className="flex gap-1 mb-2">
            <button
              onClick={() => setFilterPlayerId(null)}
              className={
                'flex-1 min-h-[36px] rounded-lg text-xs font-semibold ' +
                (!filterPlayerId
                  ? 'bg-ink text-page'
                  : 'bg-surface text-ink border border-ink/20')
              }
            >
              All
            </button>
            {players.map((gp) => (
              <button
                key={gp.playerId}
                onClick={() => setFilterPlayerId(gp.playerId)}
                className={
                  'flex-1 min-h-[36px] rounded-lg text-xs font-semibold ' +
                  (filterPlayerId === gp.playerId
                    ? 'bg-ink text-page'
                    : 'bg-surface text-ink border border-ink/20')
                }
              >
                {gp.player.username}
              </button>
            ))}
          </div>
        )}
        <Heatmap throws={filteredThrows} />
        <HeatmapLegend />
      </section>

      {players.map((gp) => {
        const sets = setsByPlayer[gp.playerId] || [];
        return (
          <section key={gp.playerId} className="mb-5">
            <p className="text-xs uppercase tracking-wider text-ink/60 mb-2">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full mr-2 align-middle"
                style={{ background: BAG_HEX[gp.bagColour] }}
              />
              {gp.player.username} &middot; {sets.length} set{sets.length === 1 ? '' : 's'}
            </p>
            <ol className="flex flex-col gap-1">
              {sets.map((s) => {
                const counts = { CORNHOLE: 0, BOARD: 0, OFF: 0 };
                for (const t of s.bagThrows) counts[t.result] += 1;
                return (
                  <li
                    key={s.id}
                    className="p-2 rounded-xl bg-surface border border-ink/15 text-sm flex items-center justify-between"
                  >
                    <span className="font-medium">Set {s.setNumber}</span>
                    <span className="text-ink/80 text-xs">
                      🎯 {counts.CORNHOLE} &middot; B {counts.BOARD} &middot; ✗ {counts.OFF}
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
    </div>
  );
}
