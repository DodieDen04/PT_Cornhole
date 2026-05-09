import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { PrimaryButton, SecondaryButton, GhostButton } from '../components/Button.jsx';

export default function HomeScreen() {
  const { player, logout } = useAuth();
  const [resumeGame, setResumeGame] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const { game } = await api('/api/games/in-progress');
        if (!cancelled) setResumeGame(game);
      } catch {
        // ignore
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
        <h1 className="text-2xl font-bold tracking-tight">PT Cornhole</h1>
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
        <PrimaryButton onClick={() => navigate('/setup')}>New game</PrimaryButton>
        <SecondaryButton onClick={() => navigate('/practice/new')}>Practice</SecondaryButton>
        <SecondaryButton onClick={() => navigate('/tournaments')}>Tournaments</SecondaryButton>
        <SecondaryButton onClick={() => navigate('/history')}>History</SecondaryButton>
        <SecondaryButton onClick={() => navigate('/stats')}>My stats</SecondaryButton>
        <SecondaryButton onClick={() => navigate('/leaderboard')}>Leaderboard</SecondaryButton>
      </div>
    </div>
  );
}
