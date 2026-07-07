import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { PrimaryButton } from '../components/Button.jsx';
import { getPendingInvite } from '../lib/pendingInvite.js';

export default function RegisterScreen() {
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const { register, firstRun } = useAuth();
  const navigate = useNavigate();

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    const trimmed = username.trim();
    if (trimmed.length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }
    if (pin !== pin2) {
      setError('PINs do not match');
      return;
    }
    setSubmitting(true);
    try {
      await register(trimmed, pin);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      <h1 className="text-3xl font-bold mb-2 tracking-tight">Create account</h1>
      {firstRun && (
        <p className="text-sm text-ink/80 mb-6 max-w-sm text-center">
          You will be the first player and become admin.
        </p>
      )}
      {getPendingInvite() && (
        <p className="text-sm text-ink/80 max-w-sm text-center">
          After registering you'll join your group automatically.
        </p>
      )}
      <form onSubmit={onSubmit} className="w-full max-w-sm flex flex-col gap-4 mt-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-ink/80">Username</span>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. Ben, Benny T, BenTheThrower"
            minLength={3}
            className="min-h-[48px] px-4 rounded-xl bg-surface border border-ink/20 text-ink outline-none focus:border-ink/60 placeholder:text-ink/40"
            required
          />
          <span className="text-xs text-ink/60">
            This is your display name in games (at least 3 characters).
          </span>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-ink/80">PIN (4 digits)</span>
          <input
            type="password"
            inputMode="numeric"
            pattern="\d{4}"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            className="min-h-[48px] px-4 rounded-xl bg-surface border border-ink/20 text-ink outline-none focus:border-ink/60 tracking-[0.5em] text-center"
            required
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-ink/80">Confirm PIN</span>
          <input
            type="password"
            inputMode="numeric"
            pattern="\d{4}"
            maxLength={4}
            value={pin2}
            onChange={(e) => setPin2(e.target.value.replace(/\D/g, ''))}
            className="min-h-[48px] px-4 rounded-xl bg-surface border border-ink/20 text-ink outline-none focus:border-ink/60 tracking-[0.5em] text-center"
            required
          />
        </label>
        {error && <p className="text-sm text-[#EF4444]">{error}</p>}
        <PrimaryButton type="submit" disabled={submitting || pin.length !== 4}>
          {submitting ? 'Creating...' : 'Create account'}
        </PrimaryButton>
      </form>
      <Link to="/login" className="mt-6 text-sm text-ink underline underline-offset-2">
        Have an account? Login
      </Link>
    </div>
  );
}
