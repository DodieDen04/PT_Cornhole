import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { PrimaryButton, SecondaryButton, GhostButton } from '../components/Button.jsx';
import PTLogo from '../components/PTLogo.jsx';
import { setPendingInvite, clearPendingInvite } from '../lib/pendingInvite.js';

const REASON_TEXT = {
  unknown: 'This invite link does not exist. Check it was copied in full.',
  revoked: 'This invite link has been withdrawn by the group admin.',
  expired: 'This invite link has expired. Ask the group admin for a new one.',
  exhausted: 'This invite link has reached its usage limit. Ask the group admin for a new one.',
};

export default function JoinGroupScreen() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { player, ready } = useAuth();
  const [info, setInfo] = useState(null);
  const [error, setError] = useState(null);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    fetch(`/api/invite/${token}`)
      .then((r) => r.json())
      .then(setInfo)
      .catch(() => setError('Could not load this invite. Are you online?'));
  }, [token]);

  async function join() {
    setJoining(true);
    setError(null);
    try {
      const { groupId } = await api(`/api/invite/${token}/accept`, { method: 'POST' });
      clearPendingInvite();
      navigate(`/groups/${groupId}`, { replace: true });
    } catch (err) {
      setError(err.message);
      setJoining(false);
    }
  }

  function goRegister() {
    setPendingInvite(token);
    navigate('/register');
  }

  function goLogin() {
    setPendingInvite(token);
    navigate('/login');
  }

  if (!ready || (!info && !error)) {
    return <div className="min-h-screen flex items-center justify-center text-ink/70">Loading...</div>;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      <PTLogo className="h-10 mb-6" />

      {error && <p className="text-sm text-[#EF4444] mb-4 text-center">{error}</p>}

      {info && !info.valid ? (
        <>
          <h1 className="text-xl font-bold mb-2 text-center">Invite not valid</h1>
          <p className="text-sm text-ink/70 mb-6 max-w-sm text-center">
            {REASON_TEXT[info.reason] || 'This invite link cannot be used.'}
          </p>
          <GhostButton onClick={() => navigate('/')}>Go to the app</GhostButton>
        </>
      ) : info ? (
        <>
          <p className="text-xs uppercase tracking-wider text-ink/60 mb-1">
            You are invited to join
          </p>
          <h1 className="text-2xl font-bold mb-1 text-center">{info.group.name}</h1>
          <p className="text-sm text-ink/70 mb-6">
            {info.group.memberCount} member{info.group.memberCount === 1 ? '' : 's'}
          </p>

          {player ? (
            <PrimaryButton className="w-full max-w-sm" disabled={joining} onClick={join}>
              {joining ? 'Joining...' : `Join as ${player.username}`}
            </PrimaryButton>
          ) : (
            <div className="w-full max-w-sm flex flex-col gap-2">
              <PrimaryButton onClick={goRegister}>Create account and join</PrimaryButton>
              <SecondaryButton onClick={goLogin}>Log in and join</SecondaryButton>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
