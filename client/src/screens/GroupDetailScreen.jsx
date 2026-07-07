import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import QRCode from 'qrcode';
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
    return <div className="min-h-screen flex items-center justify-center text-ink/70">Loading...</div>;
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
        <p className="text-xs uppercase tracking-wider text-ink/60 mb-2">
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
                className="p-3 rounded-xl bg-surface border border-ink/15 flex items-center gap-2"
              >
                <span className="flex-1 font-medium truncate">
                  {m.player.username}
                  {isMe && <span className="ml-1 text-xs text-ink/60">(you)</span>}
                </span>
                {isCreator && (
                  <span className="text-[10px] uppercase tracking-wider text-[#FFD700]">Admin</span>
                )}
                {m.player.isGuest && (
                  <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-ink/15 text-ink/80 border border-ink/30">
                    Guest
                  </span>
                )}
                {showRemove && (
                  <button
                    disabled={busy}
                    onClick={() => removeMember(m.playerId, m.player.username)}
                    aria-label={`Remove ${m.player.username}`}
                    className="w-7 h-7 rounded-lg bg-[#7F1D1D]/60 text-ink text-xs"
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
          <p className="text-xs uppercase tracking-wider text-ink/60 mb-2">
            Pending invitations ({pending.length})
          </p>
          <ul className="flex flex-col gap-1.5">
            {pending.map((m) => (
              <li
                key={m.id}
                className="p-3 rounded-xl bg-surface border border-ink/15 flex items-center gap-2"
              >
                <span className="flex-1 font-medium truncate">{m.player.username}</span>
                <span className="text-xs text-ink/60">waiting</span>
                <button
                  disabled={busy}
                  onClick={() => removeMember(m.playerId, m.player.username)}
                  aria-label={`Cancel ${m.player.username}`}
                  className="w-7 h-7 rounded-lg bg-[#7F1D1D]/60 text-ink text-xs"
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
          <InviteByUsername groupId={id} onDone={flash} />
        </section>
      )}

      {isAdmin && <InviteLinksSection groupId={id} />}

      {isAdmin && (
        <TransferAdminSection
          groupId={id}
          members={members}
          meId={player.id}
          busy={busy}
          onDone={(text) => {
            flash(text);
            load();
          }}
        />
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

function InviteByUsername({ groupId, onDone }) {
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function invite() {
    const name = username.trim();
    if (!name) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api(`/api/groups/${groupId}/invite-username`, {
        method: 'POST',
        body: { username: name },
      });
      setUsername('');
      onDone(`Invited ${res.username}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="text-xs text-ink/60 mb-1">
        Know someone's exact username? Invite them directly:
      </p>
      <div className="flex gap-2">
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Exact username"
          maxLength={30}
          className="flex-1 min-h-[40px] px-3 rounded-lg bg-surface border border-ink/20 text-ink outline-none text-sm"
        />
        <button
          onClick={invite}
          disabled={busy || !username.trim()}
          className="min-h-[40px] px-3 rounded-lg bg-ink text-page font-semibold text-sm disabled:opacity-50"
        >
          {busy ? '...' : 'Invite'}
        </button>
      </div>
      {error && <p className="text-xs text-[#EF4444] mt-1">{error}</p>}
    </div>
  );
}

function InviteLinksSection({ groupId }) {
  const [links, setLinks] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [qr, setQr] = useState(null); // { linkId, dataUrl }

  const loadLinks = useCallback(() => {
    api(`/api/groups/${groupId}/links`)
      .then((d) => setLinks(d.links))
      .catch(() => {});
  }, [groupId]);

  useEffect(() => {
    loadLinks();
  }, [loadLinks]);

  function urlFor(link) {
    return `${window.location.origin}/join/${link.token}`;
  }

  async function createLink() {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/groups/${groupId}/links`, { method: 'POST', body: {} });
      loadLinks();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function revoke(link) {
    if (!window.confirm('Withdraw this invite link? Anyone holding it can no longer join.')) return;
    setBusy(true);
    try {
      await api(`/api/groups/${groupId}/links/${link.id}`, { method: 'DELETE' });
      if (qr?.linkId === link.id) setQr(null);
      loadLinks();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function copy(link) {
    try {
      await navigator.clipboard.writeText(urlFor(link));
      setCopiedId(link.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      window.prompt('Copy this link:', urlFor(link));
    }
  }

  async function toggleQr(link) {
    if (qr?.linkId === link.id) {
      setQr(null);
      return;
    }
    const dataUrl = await QRCode.toDataURL(urlFor(link), { width: 480, margin: 1 });
    setQr({ linkId: link.id, dataUrl });
  }

  return (
    <section className="mb-5">
      <p className="text-xs uppercase tracking-wider text-ink/60 mb-2">Invite links</p>
      <p className="text-xs text-ink/60 mb-2">
        Anyone with the link can join this group, even without an account yet. Links last 7 days.
      </p>
      {error && <p className="text-xs text-[#EF4444] mb-2">{error}</p>}

      {links.length > 0 && (
        <ul className="flex flex-col gap-1.5 mb-2">
          {links.map((link) => (
            <li key={link.id} className="p-3 rounded-xl bg-surface border border-ink/15">
              <div className="flex items-center gap-2">
                <span className="flex-1 text-xs text-ink/70 truncate">{urlFor(link)}</span>
                <button
                  disabled={busy}
                  onClick={() => revoke(link)}
                  aria-label="Withdraw link"
                  className="w-7 h-7 rounded-lg bg-[#7F1D1D]/60 text-ink text-xs shrink-0"
                >
                  ✕
                </button>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={() => copy(link)}
                  className="flex-1 min-h-[36px] rounded-lg bg-ink text-page text-xs font-semibold"
                >
                  {copiedId === link.id ? 'Copied!' : 'Copy link'}
                </button>
                <button
                  onClick={() => toggleQr(link)}
                  className="flex-1 min-h-[36px] rounded-lg bg-surface-2 text-ink border border-ink/20 text-xs font-semibold"
                >
                  {qr?.linkId === link.id ? 'Hide QR' : 'Show QR'}
                </button>
              </div>
              <p className="text-[10px] text-ink/50 mt-1.5">
                Used {link.useCount}
                {link.maxUses ? ` of ${link.maxUses}` : ' times'} &middot; expires{' '}
                {new Date(link.expiresAt).toLocaleDateString()}
              </p>
              {qr?.linkId === link.id && (
                <div className="mt-2 p-2 rounded-lg bg-white">
                  <img src={qr.dataUrl} alt="Invite QR code" className="w-full max-w-[240px] mx-auto" />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <SecondaryButton className="w-full" disabled={busy} onClick={createLink}>
        {busy ? '...' : 'Create invite link'}
      </SecondaryButton>
    </section>
  );
}

function TransferAdminSection({ groupId, members, meId, busy, onDone }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(null);
  const [transferring, setTransferring] = useState(false);

  const eligible = members.filter((m) => m.playerId !== meId && !m.player.isGuest);

  async function transfer(m) {
    if (
      !window.confirm(
        `Make ${m.player.username} the group admin? You will become a normal member.`,
      )
    ) {
      return;
    }
    setTransferring(true);
    setError(null);
    try {
      await api(`/api/groups/${groupId}/transfer-admin`, {
        method: 'POST',
        body: { playerId: m.playerId },
      });
      setOpen(false);
      onDone(`${m.player.username} is now admin`);
    } catch (e) {
      setError(e.message);
    } finally {
      setTransferring(false);
    }
  }

  if (eligible.length === 0) return null;

  return (
    <section className="mb-5">
      <SecondaryButton className="w-full" disabled={busy} onClick={() => setOpen((o) => !o)}>
        {open ? 'Cancel transfer' : 'Transfer admin'}
      </SecondaryButton>
      {open && (
        <div className="mt-2">
          <p className="text-xs text-ink/60 mb-2">Pick the new admin:</p>
          {error && <p className="text-xs text-[#EF4444] mb-2">{error}</p>}
          <ul className="flex flex-col gap-1.5">
            {eligible.map((m) => (
              <li key={m.id}>
                <button
                  disabled={transferring}
                  onClick={() => transfer(m)}
                  className="w-full p-2.5 rounded-xl bg-surface border border-ink/20 text-left font-medium disabled:opacity-50"
                >
                  {m.player.username}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
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
      <div className="w-full max-w-sm rounded-2xl bg-surface-2 border border-ink/25 p-5 shadow-2xl flex flex-col" style={{ maxHeight: 'calc(100dvh - 2rem)' }}>
        <h3 className="text-lg font-bold mb-1">
          {mode === 'invite' ? 'Invite players' : 'Add guest players'}
        </h3>
        <p className="text-xs text-ink/70 mb-3">
          {mode === 'invite'
            ? 'Registered users will see an invitation. Pick any number.'
            : 'Guests are added immediately. Pick any number.'}
        </p>

        {error && (
          <p className="mb-2 p-2 rounded-lg bg-[#EF4444]/15 text-[#EF4444] text-sm">{error}</p>
        )}

        <div className="flex-1 overflow-y-auto -mx-1 px-1 mb-3">
          {loading ? (
            <p className="text-sm text-ink/70">Loading...</p>
          ) : candidates.length === 0 ? (
            <p className="text-sm text-ink/70">
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
                          ? 'bg-ink text-page'
                          : 'bg-surface text-ink border border-ink/20')
                      }
                    >
                      <span
                        className={
                          'w-4 h-4 rounded border ' +
                          (checked
                            ? 'bg-surface-2 border-surface-2'
                            : 'border-ink/40')
                        }
                      >
                        {checked && (
                          <span className="block text-[10px] leading-4 text-center text-ink">✓</span>
                        )}
                      </span>
                      <span className="flex-1 truncate font-medium">{p.username}</span>
                      {p.isGuest && (
                        <span
                          className={
                            'text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full border ' +
                            (checked
                              ? 'bg-surface-2/15 text-page border-surface-2/30'
                              : 'bg-ink/15 text-ink/80 border-ink/30')
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
