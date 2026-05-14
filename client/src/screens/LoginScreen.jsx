import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { PrimaryButton, GhostButton } from '../components/Button.jsx';

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(username.trim(), pin);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      <h1 className="text-3xl font-bold mb-8 tracking-tight">PT Cornhole</h1>
      <form onSubmit={onSubmit} className="w-full max-w-sm flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-ink/80">Username</span>
          <input
            type="text"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="min-h-[48px] px-4 rounded-xl bg-surface border border-ink/20 text-ink outline-none focus:border-ink/60"
            required
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-ink/80">PIN (4 digits)</span>
          <input
            type="password"
            inputMode="numeric"
            pattern="\d{4}"
            maxLength={4}
            autoComplete="current-password"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            className="min-h-[48px] px-4 rounded-xl bg-surface border border-ink/20 text-ink outline-none focus:border-ink/60 tracking-[0.5em] text-center"
            required
          />
        </label>
        {error && <p className="text-sm text-[#EF4444]">{error}</p>}
        <PrimaryButton type="submit" disabled={submitting || pin.length !== 4}>
          {submitting ? 'Logging in...' : 'Login'}
        </PrimaryButton>
      </form>
      <div className="mt-6 flex flex-col items-center gap-1">
        <Link to="/register" className="text-sm text-ink underline underline-offset-2">
          Create account
        </Link>
        <GhostButton type="button" onClick={() => setShowForgot((s) => !s)}>
          Forgotten PIN?
        </GhostButton>
        {showForgot && (
          <p className="text-xs text-ink/70 max-w-xs text-center mt-1">
            Ask the admin to reset your PIN.
          </p>
        )}
      </div>
    </div>
  );
}
