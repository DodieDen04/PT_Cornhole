import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { PrimaryButton, SecondaryButton, GhostButton } from '../components/Button.jsx';
import PTLogo from '../components/PTLogo.jsx';

export default function HomeScreen() {
  const { player } = useAuth();
  const [resumeGame, setResumeGame] = useState(null);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [gameRes, invRes] = await Promise.all([
          api('/api/games/in-progress').catch(() => ({ game: null })),
          api('/api/invitations').catch(() => ({ invitations: [] })),
        ]);
        if (!cancelled) {
          setResumeGame(gameRes.game);
          setInvitations(invRes.invitations || []);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  function resumeUrl(game) {
    return game.mode === 'COMPETITIVE' ? `/game/${game.id}` : `/practice/${game.id}`;
  }

  return (
    <div className="min-h-screen flex flex-col px-5 py-6">
      <header className="flex items-center justify-between mb-8">
        <PTLogo className="h-8" />
        <div className="flex items-center gap-3">
          <span className="text-sm opacity-80">{player.username}</span>
          <GhostButton onClick={() => navigate('/settings')} aria-label="Settings">⚙</GhostButton>
        </div>
      </header>

      {!loading && resumeGame && (
        <div className="mb-6 p-4 rounded-2xl bg-[#082F58] border border-[#FAEEDA]/20">
          <p className="text-sm text-[#FAEEDA]/80 mb-2">
            Game in progress, {resumeGame.mode === 'COMPETITIVE' ? 'Competitive' : 'Practice'}
          </p>
          <PrimaryButton className="w-full" onClick={() => navigate(resumeUrl(resumeGame))}>
            Resume game
          </PrimaryButton>
        </div>
      )}

      <div className="flex flex-col gap-3 max-w-md w-full mx-auto">
        <PrimaryButton onClick={() => navigate('/setup')}>Start Match</PrimaryButton>
        <SecondaryButton onClick={() => navigate('/practice/new')}>Practice Mode</SecondaryButton>

        {!loading && invitations.length > 0 && (
          <button
            onClick={() => navigate('/invitations')}
            className="mt-2 p-3 rounded-2xl bg-[#FFD700]/15 border border-[#FFD700]/40 text-[#FAEEDA] text-left flex items-center gap-3"
          >
            <span className="w-7 h-7 rounded-full bg-[#FFD700] text-[#0C447C] font-bold text-sm flex items-center justify-center shrink-0">
              {invitations.length}
            </span>
            <span className="flex-1">
              You have {invitations.length} group invitation
              {invitations.length === 1 ? '' : 's'}
            </span>
            <span className="text-[#FAEEDA]/60">›</span>
          </button>
        )}
      </div>
    </div>
  );
}
