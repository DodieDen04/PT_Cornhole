import { useEffect, useState, useCallback } from 'react';
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
  const [discarding, setDiscarding] = useState(false);
  const navigate = useNavigate();

  const refreshResume = useCallback(async () => {
    try {
      const { game } = await api('/api/games/in-progress');
      setResumeGame(game);
    } catch {
      setResumeGame(null);
    }
  }, []);

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

  async function discardResume() {
    if (!resumeGame) return;
    const label = resumeGame.mode === 'PRACTICE' ? 'practice session' : 'match';
    if (
      !window.confirm(
        `Discard this ${label}? It'll be saved to history as abandoned. You can't get it back.`,
      )
    ) {
      return;
    }
    setDiscarding(true);
    try {
      await api(`/api/games/${resumeGame.id}/status`, {
        method: 'PUT',
        body: { status: 'ABANDONED' },
      });
      await refreshResume();
    } catch (err) {
      window.alert('Could not discard: ' + err.message);
    } finally {
      setDiscarding(false);
    }
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
        <ResumeBanner
          game={resumeGame}
          onResume={() => navigate(resumeUrl(resumeGame))}
          onDiscard={discardResume}
          discarding={discarding}
        />
      )}

      <div className="flex flex-col gap-3 max-w-md w-full mx-auto">
        <PrimaryButton onClick={() => navigate('/setup')}>Start Match</PrimaryButton>
        <SecondaryButton onClick={() => navigate('/practice/new')}>Practice Mode</SecondaryButton>

        {!loading && invitations.length > 0 && (
          <button
            onClick={() => navigate('/invitations')}
            className="mt-2 p-3 rounded-2xl bg-[#FFD700]/15 border border-[#FFD700]/40 text-ink text-left flex items-center gap-3"
          >
            <span className="w-7 h-7 rounded-full bg-[#FFD700] text-page font-bold text-sm flex items-center justify-center shrink-0">
              {invitations.length}
            </span>
            <span className="flex-1">
              You have {invitations.length} group invitation
              {invitations.length === 1 ? '' : 's'}
            </span>
            <span className="text-ink/60">›</span>
          </button>
        )}
      </div>
    </div>
  );
}

function ResumeBanner({ game, onResume, onDiscard, discarding }) {
  const lines = describeGame(game);
  return (
    <div className="mb-6 p-4 rounded-2xl bg-surface border border-ink/20">
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-sm font-semibold text-ink">
          {game.mode === 'PRACTICE' ? 'Practice in progress' : 'Match in progress'}
        </p>
        <button
          onClick={onDiscard}
          disabled={discarding}
          className="text-xs text-[#EF4444] underline underline-offset-4 shrink-0 disabled:opacity-50"
        >
          {discarding ? 'Discarding...' : 'Discard'}
        </button>
      </div>
      <div className="text-xs text-ink/70 mb-3 space-y-0.5">
        {lines.map((line, i) => (
          <p key={i}>{line}</p>
        ))}
      </div>
      <PrimaryButton className="w-full" onClick={onResume} disabled={discarding}>
        Resume
      </PrimaryButton>
    </div>
  );
}

function describeGame(game) {
  const ago = relativeTime(new Date(game.createdAt));
  if (game.mode === 'PRACTICE') {
    const sets = game.practiceSets?.length || 0;
    const playerNames = (game.players || [])
      .map((gp) => gp.player?.username || 'Player')
      .join(' & ');
    const lines = [];
    if (playerNames) lines.push(playerNames);
    if (game.practiceTag) lines.push(`Tag: ${game.practiceTag}`);
    lines.push(`${sets} set${sets === 1 ? '' : 's'} banked, started ${ago}`);
    return lines;
  }
  const t1 = (game.players || [])
    .filter((gp) => gp.team === 1)
    .map((gp) => gp.player?.username || 'Player')
    .join(' & ');
  const t2 = (game.players || [])
    .filter((gp) => gp.team === 2)
    .map((gp) => gp.player?.username || 'Player')
    .join(' & ');
  const roundNum = game.rounds?.length || 1;
  const score =
    game.team1Score != null && game.team2Score != null
      ? `${game.team1Score} – ${game.team2Score}`
      : null;
  const lines = [];
  if (t1 || t2) lines.push(`${t1 || 'Team 1'} vs ${t2 || 'Team 2'}`);
  if (score) lines.push(`Score: ${score} · round ${roundNum} · started ${ago}`);
  else lines.push(`Round ${roundNum} · started ${ago}`);
  return lines;
}

function relativeTime(date) {
  const diff = Date.now() - date.getTime();
  if (diff < 0) return 'just now';
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} minute${min === 1 ? '' : 's'} ago`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months === 1 ? '' : 's'} ago`;
}
