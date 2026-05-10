import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { PrimaryButton, GhostButton } from '../components/Button.jsx';

export default function GroupCreateScreen() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function create() {
    if (!name.trim()) {
      setError('Group name required');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const { group } = await api('/api/groups', {
        method: 'POST',
        body: { name: name.trim() },
      });
      navigate(`/groups/${group.id}`, { replace: true });
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen px-5 py-6 max-w-md mx-auto pb-12">
      <header className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-bold tracking-tight">Create group</h1>
        <GhostButton onClick={() => navigate('/groups')}>Cancel</GhostButton>
      </header>

      <p className="text-xs text-[#FAEEDA]/70 mb-3">
        Pick a name (1 to 30 characters). You'll be the admin and can invite players next.
      </p>

      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Group name"
        maxLength={30}
        className="w-full min-h-[48px] px-4 rounded-xl bg-[#082F58] border border-[#FAEEDA]/20 text-[#FAEEDA] outline-none focus:border-[#FAEEDA]/60 mb-3"
      />

      {error && <p className="text-sm text-[#EF4444] mb-3">{error}</p>}

      <PrimaryButton
        className="w-full"
        disabled={!name.trim() || submitting}
        onClick={create}
      >
        {submitting ? 'Creating...' : 'Create'}
      </PrimaryButton>
    </div>
  );
}
