const RESULT_KEY = {
  CORNHOLE: 'cornholes',
  BOARD: 'boards',
  OFF: 'offs',
};

// games: last-10 competitive trend entries, oldest first:
// [{ completedAt, throws, cornholes, boards, offs, won }]
// metric: 'WINLOSS' | 'CORNHOLE' | 'BOARD' | 'OFF'. unit: 'pct' | 'raw'.
export default function RecentFormChart({ games = [], metric = 'WINLOSS', unit = 'pct', colour = '#FFD700' }) {
  if (!games || games.length === 0) {
    return (
      <div className="rounded-xl bg-surface border border-ink/15 p-4 text-center text-sm text-ink/60">
        Play some matches to see your recent form.
      </div>
    );
  }

  if (metric === 'WINLOSS') {
    return <WinLossBlocks games={games} />;
  }

  const key = RESULT_KEY[metric];
  const values = games.map((g) => ({
    raw: g[key],
    pct: g.throws > 0 ? Math.round((g[key] / g.throws) * 1000) / 10 : 0,
    throws: g.throws,
  }));
  const shown = values.map((v) => (unit === 'pct' ? v.pct : v.raw));
  const max = unit === 'pct' ? Math.max(50, ...shown) : Math.max(4, ...shown);
  const totalRaw = values.reduce((sum, v) => sum + v.raw, 0);
  const totalThrows = values.reduce((sum, v) => sum + v.throws, 0);
  const overallPct = totalThrows > 0 ? Math.round((totalRaw / totalThrows) * 1000) / 10 : 0;

  return (
    <div className="rounded-xl bg-surface border border-ink/15 p-3">
      <div className="flex items-end gap-1.5 h-24">
        {values.map((v, i) => {
          const value = unit === 'pct' ? v.pct : v.raw;
          const heightPct = max > 0 ? (value / max) * 100 : 0;
          return (
            <div key={i} className="flex-1 flex flex-col justify-end items-center gap-0.5 h-full">
              <span className="text-[9px] text-ink/70 tabular-nums leading-none">
                {value}
                {unit === 'pct' ? '%' : ''}
              </span>
              <div
                className="w-full rounded-t"
                style={{
                  background: colour,
                  height: `${Math.max(heightPct, 2)}%`,
                  opacity: 0.9,
                }}
                title={`${v.raw} of ${v.throws} throws (${v.pct}%)`}
              />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between mt-1 text-[10px] uppercase tracking-wider text-ink/60">
        <span>Oldest</span>
        <span>
          Last {games.length}: {totalRaw} of {totalThrows} ({overallPct}%)
        </span>
        <span>Latest</span>
      </div>
    </div>
  );
}

function WinLossBlocks({ games }) {
  const wins = games.filter((g) => g.won === true).length;
  const losses = games.filter((g) => g.won === false).length;
  const decided = wins + losses;
  const winPct = decided > 0 ? Math.round((wins / decided) * 1000) / 10 : 0;

  return (
    <div className="rounded-xl bg-surface border border-ink/15 p-3">
      <div className="flex gap-1.5">
        {games.map((g, i) => (
          <div
            key={i}
            className={
              'flex-1 h-10 rounded-md flex items-center justify-center text-xs font-black text-white ' +
              (g.won === true
                ? 'bg-[#22C55E]'
                : g.won === false
                  ? 'bg-[#EF4444]'
                  : 'bg-ink/20')
            }
            title={new Date(g.completedAt).toLocaleDateString()}
          >
            {g.won === true ? 'W' : g.won === false ? 'L' : '–'}
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-2 text-[10px] uppercase tracking-wider text-ink/60">
        <span>Oldest</span>
        <span className="font-bold text-ink/80">
          {wins}W – {losses}L &middot; {winPct}% win rate
        </span>
        <span>Latest</span>
      </div>
    </div>
  );
}
