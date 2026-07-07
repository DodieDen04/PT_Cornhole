import { useState } from 'react';
import { PrimaryButton, GhostButton } from './Button.jsx';

export default function ThrowOrderModal({
  is2v2,
  team1Ids,
  team2Ids,
  team1Hex,
  team2Hex,
  playersById,
  onCancel,
  onConfirm,
}) {
  const [startingTeam, setStartingTeam] = useState(1);
  const [team1Order, setTeam1Order] = useState(team1Ids);
  const [team2Order, setTeam2Order] = useState(team2Ids);

  function nameOf(id) {
    const p = playersById[id];
    return p ? p.username : '';
  }

  function swap(setter) {
    setter((order) => (order.length === 2 ? [order[1], order[0]] : order));
  }

  function confirm() {
    onConfirm({ startingTeam, team1Order, team2Order });
  }

  return (
    <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4">
      <div
        className="w-full max-w-sm rounded-2xl bg-surface-2 border border-ink/25 p-5 shadow-2xl flex flex-col"
        style={{ maxHeight: 'calc(100dvh - 2rem)' }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold">Throw order</h3>
          <GhostButton onClick={onCancel}>Cancel</GhostButton>
        </div>

        <section className="mb-4">
          <p className="text-xs uppercase tracking-wider text-ink/60 mb-2">
            Which team throws first?
          </p>
          <div className="grid grid-cols-2 gap-2">
            <TeamToggle
              label="Team 1"
              colour={team1Hex}
              active={startingTeam === 1}
              onClick={() => setStartingTeam(1)}
            />
            <TeamToggle
              label="Team 2"
              colour={team2Hex}
              active={startingTeam === 2}
              onClick={() => setStartingTeam(2)}
            />
          </div>
        </section>

        {is2v2 && (
          <section className="mb-4">
            <p className="text-xs uppercase tracking-wider text-ink/60 mb-2">
              Throwing order within each team
            </p>
            <div className="grid grid-cols-[auto_1fr_1fr] gap-2 items-center">
              <div />
              <ColumnHeader label="Team 1" colour={team1Hex} />
              <ColumnHeader label="Team 2" colour={team2Hex} />

              <RowLabel>1st</RowLabel>
              <PlayerSlot
                name={nameOf(team1Order[0])}
                colour={team1Hex}
                onClick={() => swap(setTeam1Order)}
              />
              <PlayerSlot
                name={nameOf(team2Order[0])}
                colour={team2Hex}
                onClick={() => swap(setTeam2Order)}
              />

              <RowLabel>2nd</RowLabel>
              <PlayerSlot
                name={nameOf(team1Order[1])}
                colour={team1Hex}
                onClick={() => swap(setTeam1Order)}
              />
              <PlayerSlot
                name={nameOf(team2Order[1])}
                colour={team2Hex}
                onClick={() => swap(setTeam2Order)}
              />
            </div>
            <p className="text-xs text-ink/60 mt-2">
              Tap a card to swap with its teammate.
            </p>
          </section>
        )}

        <PrimaryButton className="w-full mt-2" onClick={confirm}>
          Start game
        </PrimaryButton>
      </div>
    </div>
  );
}

function TeamToggle({ label, colour, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={
        'min-h-[44px] rounded-xl font-semibold flex items-center justify-center gap-2 transition ' +
        (active
          ? 'bg-ink text-page border border-ink'
          : 'bg-surface text-ink border border-ink/20')
      }
    >
      <span
        className="w-2.5 h-2.5 rounded-full shrink-0"
        style={{ background: colour }}
      />
      {label}
    </button>
  );
}

function ColumnHeader({ label, colour }) {
  return (
    <div className="flex items-center justify-center gap-1.5 text-xs uppercase tracking-wider text-ink/60">
      <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{ background: colour }}
      />
      {label}
    </div>
  );
}

function RowLabel({ children }) {
  return (
    <div className="text-xs uppercase tracking-wider text-ink/60 pr-1">
      {children}
    </div>
  );
}

function PlayerSlot({ name, colour, onClick }) {
  return (
    <button
      onClick={onClick}
      className="min-h-[48px] px-3 rounded-xl bg-surface border border-ink/20 text-ink font-medium flex items-center gap-2 text-left active:scale-[0.99] transition"
    >
      <span
        className="w-2.5 h-2.5 rounded-full shrink-0"
        style={{ background: colour }}
      />
      <span className="flex-1 truncate text-sm">{name}</span>
    </button>
  );
}
