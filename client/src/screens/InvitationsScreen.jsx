import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { PrimaryButton, SecondaryButton, GhostButton } from '../components/Button.jsx';

export default function InvitationsScreen() {
  const navigate = useNavigate();
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [info, setInfo] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    api('/api/invitations')
      .then((d) => setInvitations(d.invitations))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function flash(text) {
    setInfo(text);
    setTimeout(() => setInfo(null), 2500);
  }

  async function accept(groupId, groupName) {
    setBusyId(groupId);
    try {
      await api(`/api/groups/${groupId}/accept`, { method: 'POST' });
      setInvitations((list) => list.filter((i) => i.groupId !== groupId));
      flash(`Joined ${groupName}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function decline(groupId) {
    setBusyId(groupId);
    try {
      await api(`/api/groups/${groupId}/decline`, { method: 'POST' });
      setInvitations((list) => list.filter((i) => i.groupId !== groupId));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="min-h-screen px-5 py-6 max-w-md mx-auto pb-12">
      <header className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-bold tracking-tight">Group invitations</h1>
        <GhostButton onClick={() => navigate('/')}>Home</GhostButton>
      </header>

      {info && (
        <p className="mb-3 p-2 rounded-lg bg-[#22C55E]/15 text-[#22C55E] text-sm">{info}</p>
      )}
      {error && (
        <p className="mb-3 p-2 rounded-lg bg-[#EF4444]/15 text-[#EF4444] text-sm">{error}</p>
      )}

      {loading ? (
        <p className="text-sm text-ink/70">Loading...</p>
      ) : invitations.length === 0 ? (
        <p className="text-sm text-ink/70">No pending invitations.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {invitations.map((inv) => (
            <li
              key={inv.groupId}
              className="p-4 rounded-2xl bg-surface border border-ink/15"
            >
              <p className="font-semibold text-base">{inv.groupName}</p>
              <p className="text-xs text-ink/70 mt-0.5">
                Invited by {inv.invitedBy} &middot; {inv.memberCount} member{inv.memberCount === 1 ? '' : 's'}
              </p>
              <div className="grid grid-cols-2 gap-2 mt-3">
                <SecondaryButton
                  disabled={busyId === inv.groupId}
                  onClick={() => decline(inv.groupId)}
                >
                  Decline
                </SecondaryButton>
                <PrimaryButton
                  disabled={busyId === inv.groupId}
                  onClick={() => accept(inv.groupId, inv.groupName)}
                >
                  Accept
                </PrimaryButton>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
