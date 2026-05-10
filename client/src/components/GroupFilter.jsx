import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function GroupFilter({ value, onChange, allLabel = 'All Games' }) {
  const [groups, setGroups] = useState([]);

  useEffect(() => {
    api('/api/groups').then((d) => setGroups(d.groups)).catch(() => {});
  }, []);

  if (groups.length === 0) return null;

  const activeName = value ? groups.find((g) => g.id === value)?.name : null;

  return (
    <div className="mb-4">
      <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
        <Chip label={allLabel} active={!value} onClick={() => onChange(null)} />
        {groups.map((g) => (
          <Chip
            key={g.id}
            label={g.name}
            active={value === g.id}
            onClick={() => onChange(g.id)}
          />
        ))}
      </div>
      {activeName && (
        <p className="text-xs text-[#FAEEDA]/60 mt-1">Filtered: {activeName}</p>
      )}
    </div>
  );
}

function Chip({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={
        'shrink-0 min-h-[36px] px-3 rounded-full text-xs font-semibold whitespace-nowrap transition ' +
        (active
          ? 'bg-[#FAEEDA] text-[#0C447C]'
          : 'bg-[#082F58] text-[#FAEEDA] border border-[#FAEEDA]/20')
      }
    >
      {label}
    </button>
  );
}
