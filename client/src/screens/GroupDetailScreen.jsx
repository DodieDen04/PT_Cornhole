import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { PrimaryButton, SecondaryButton, DangerButton, GhostButton } from '../components/Button.jsx';

export default function GroupDetailScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { player } = useAuth();
  const [group, setGroup] = useState(null);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [busy, setBusy] = useState(false);
  const [pickerMode, setPickerMode] = useState(null); // 'invite' or 'guests'

  const load = useCallback(() => {
    api(`/api/groups/${id}`)
      .then((d) => setGroup(d.group))
      .catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  function flash(text) {
    setInfo(text);
    setTimeout(() => setInfo(null), 2500);
  }

  async function removeMember(playerId, name) {
    if (!window.confirm(`Remove ${name} from the group?`)) return;
    setBusy(true);
    try {
      await api(`/api/groups/${id}/members/${playerId}`, { method: 'DELETE' });
      flash(`${name} removed`);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function leaveGroup() {
    if (!window.confirm('Leave this group?')) return;
    setBusy(true);
    try {
      await api(`/api/groups/${id}/leave`, { method: 'POST' });
      navigate('/groups', { replace: true });
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  async function renameGroup() {
    const next = window.prompt('New group name:', group.name);
    if (!next) return;
    const trimmed = next.trim();
    if (trimmed === '' || trimmed === group.name) return;
    setBusy(true);
    try {
      await api(`/api/groups/${id}`, { method: 'PUT', body: { name: trimmed } });
      flash('Renamed');
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteGroup() {
    if (
      !window.confirm(
        `Delete ${group.name}? This will remove all members. Games played in this group will keep their records but will no longer be linked to a group.`,
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await api(`/api/groups/${id}`, { method: 'DELETE' });
      navigate('/groups', { replace: true });
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  if (error && !group) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6">
        <p className="text-[#EF4444] mb-3">{error}</p>
        <GhostButton onClick={() => navigate('/groups')}>Back</GhostButton>
      </div>
    );
  }
  if (!group) {
    return <div className="min-h-screen flex items-center justify-center text-[#FAEEDA]/70">Loading...</div>;
  }

  const isAdmin = group.isAdmin;
  const members = (group.members || []).filter((m) => m.status === 'MEMBER');
  const pending = (group.members || []).filter((m) => m.status === 'INVITED');

  return (
    <div className="min-h-screen px-5 py-6 max-w-md mx-auto pb-12">
      <header className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-bold tracking-tight truncate">{group.name}</h1>
        <GhostButton onClick={() => navigate('/groups')}>Back</GhostButton>
      </header>

      {info && (
        <p className="mb-3 p-2 rounded-lg bg-[#22C55E]/15 text-[#22C55E] text-sm">{info}</p>
      )}
      {error && (
        <p className="mb-3 p-2 rounded-lg bg-[#EF4444]/15 text-[#EF4444] text-sm">{error}</p>
      )}

      <section className="mb-5">
        <p className="text-xs uppercase tracking-wider text-[#FAEEDA]/60 mb-2">
          Members ({members.length})
        </p>
        <ul className="flex flex-col gap-1.5">
          {members.map((m) => {
            const isCreator = m.playerId === group.createdBy;
            const isMe = m.playerId === player.id;
            const showRemove = isAdmin && !isCreator;
            return (
              <li
                key={m.id}
                className="p-3 rounded-xl bg-[#082F58] border border-[#FAEEDA]/15 flex items-center gap-2"
              >
                <span className="flex-1 font-medium truncate">
                  {m.player.username}
                  {isMe && <span className="ml-1 text-xs text-[#FAEEDA]/60">(you)</span>}
                </span>
                {isCreator && (
                  <span className="text-[10px] uppercase tracking-wider text-[#FFD700]">Admin</span>
                )}
                {m.player.isGuest && (
                  <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-[#FAEEDA]/15 text-[#FAEEDA]/80 border border-[#FAEEDA]/30">
                    Guest
                  </span>
                )}
                {showRemove && (
                  <button
                    disabled={busy}
                    onClick={() => removeMember(m.playerId, m.player.username)}
                    aria-label={`Remove ${m.player.username}`}
                    className="w-7 h-7 rounded-lg bg-[#7F1D1D]/60 text-[#FAEEDA] text-xs"
                  >
                    ✕
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {isAdmin && pending.length > 0 && (
        <section className="mb-5">
          <p className="text-xs uppercase tracking-wider text-[#FAEEDA]/60 mb-2">
            Pending invitations ({pending.length})
          </p>
          <ul className="flex flex-col gap-1.5">
            {pending.map((m) => (
              <li
                key={m.id}
                className="p-3 rounded-xl bg-[#082F58] border border-[#FAEEDA]/15 flex items-center gap-2"
              >
                <span className="flex-1 font-medium truncate">{m.player.username}</span>
                <span className="text-xs text-[#FAEEDA]/60">waiting</span>
                <button
                  disabled={busy}
                  onClick={() => removeMember(m.playerId, m.player.username)}
                  aria-label={`Cancel ${m.player.username}`}
                  className="w-7 h-7 rounded-lg bg-[#7F1D1D]/60 text-[#FAEEDA] text-xs"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {isAdmin && (
        <section className="mb-5 flex flex-col gap-2">
          <SecondaryButton onClick={() => setPickerMode('invite')}>
            Invite players
          </SecondaryButton>
          <SecondaryButton onClick={() => setPickerMode('guests')}>
            Add guest players
          </SecondaryButton>
        </section>
      )}

      {isAdmin ? (
        <section className="mb-5 flex flex-col gap-2">
          <SecondaryButton disabled={busy} onClick={renameGroup}>
            Rename group
          </SecondaryButton>
          <DangerButton disabled={busy} onClick={deleteGroup}>
            Delete group
          </DangerButton>
        </section>
      ) : (
        <DangerButton className="w-full" disabled={busy} onClick={leaveGroup}>
          Leave group
        </DangerButton>
      )}

      {pickerMode && (
        <PlayerPickerModal
          mode={pickerMode}
          existingMembers={group.members || []}
          groupId={id}
          onClose={() => setPickerMode(null)}
          onDone={(text) => {
            setPickerMode(null);
            flash(text);
            load();
          }}
        />
      )}
    </div>
  );
}

function PlayerPickerModal({ mode, existingMembers, groupId, onClose, onDone }) {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api('/api/players')
      .then((d) => setPlayers(d.players))
      .catch(() => setPlayers([]))
      .finally(() => setLoading(false));
  }, []);

  const existingIds = useMemo(
    () => new Set(existingMembers.map((m) => m.playerId)),
    [existingMembers],
  );

  const candidates = useMemo(() => {
    return players.filter((p) => {
      if (existingIds.has(p.id)) return false;
      if (mode === 'invite') return !p.isGuest;
      if (mode === 'guests') return p.isGuest;
      return false;
    });
  }, [players, existingIds, mode]);

  function toggle(playerId) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(playerId)) next.delete(playerId);
      else next.add(playerId);
      return next;
    });
  }

  async function confirm() {
    if (selected.size === 0) {
      onClose();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const path = mode === 'invite' ? 'invite' : 'add-guests';
      const res = await api(`/api/groups/${groupId}/${path}`, {
        method: 'POST',
        body: { playerIds: Array.from(selected) },
      });
      const verb = mode === 'invite' ? 'invited' : 'added';
      const count = res.invited ?? res.added ?? selected.size;
      onDone(`${count} player${count === 1 ? '' : 's'} ${verb}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/75 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl bg-[#0C447C] border border-[#FAEEDA]/25 p-5 shadow-2xl flex flex-col" style={{ maxHeight: 'calc(100dvh - 2rem)' }}>
        <h3 className="text-lg font-bold mb-1">
          {mode === 'invite' ? 'Invite players' : 'Add guest players'}
        </h3>
        <p className="text-xs text-[#FAEEDA]/70 mb-3">
          {mode === 'invite'
            ? 'Registered users will see an invitation. Pick any number.'
            : 'Guests are added immediately. Pick any number.'}
        </p>

        {error && (
          <p className="mb-2 p-2 rounded-lg bg-[#EF4444]/15 text-[#EF4444] text-sm">{error}</p>
        )}

        <div className="flex-1 overflow-y-auto -mx-1 px-1 mb-3">
          {loading ? (
            <p className="text-sm text-[#FAEEDA]/70">Loading...</p>
          ) : candidates.length === 0 ? (
            <p className="text-sm text-[#FAEEDA]/70">
              {mode === 'invite'
                ? 'No registered users available to invite.'
                : 'No guest players available. Create one from the New Game screen.'}
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {candidates.map((p) => {
                const checked = selected.has(p.id);
                return (
                  <li key={p.id}>
                    <button
                      onClick={() => toggle(p.id)}
                      className={
                        'w-full p-2.5 rounded-xl flex items-center gap-2 text-left ' +
                        (checked
                          ? 'bg-[#FAEEDA] text-[#0C447C]'
                          : 'bg-[#082F58] text-[#FAEEDA] border border-[#FAEEDA]/20')
                      }
                    >
                      <span
                        className={
                          'w-4 h-4 rounded border ' +
                          (checked
                            ? 'bg-[#0C447C] border-[#0C447C]'
                            : 'border-[#FAEEDA]/40')
                        }
                      >
                        {checked && (
                          <span className="block text-[10px] leading-4 text-center text-[#FAEEDA]">✓</span>
                        )}
                      </span>
                      <span className="flex-1 truncate font-medium">{p.username}</span>
                      {p.isGuest && (
                        <span
                          className={
                            'text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full border ' +
                            (checked
                              ? 'bg-[#0C447C]/15 text-[#0C447C] border-[#0C447C]/30'
                              : 'bg-[#FAEEDA]/15 text-[#FAEEDA]/80 border-[#FAEEDA]/30')
                          }
                        >
                          Guest
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <PrimaryButton disabled={busy || selected.size === 0} onClick={confirm}>
            {busy
              ? '...'
              : selected.size === 0
              ? mode === 'invite'
                ? 'Invite'
                : 'Add'
              : `${mode === 'invite' ? 'Invite' : 'Add'} ${selected.size}`}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}
