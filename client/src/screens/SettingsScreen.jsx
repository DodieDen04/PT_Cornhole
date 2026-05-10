import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { PrimaryButton, SecondaryButton, DangerButton, GhostButton } from '../components/Button.jsx';
import { useTheme } from '../contexts/ThemeContext.jsx';

export default function SettingsScreen() {
  const { player, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [players, setPlayers] = useState([]);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [busy, setBusy] = useState(false);

  const refreshPlayers = () =>
    api('/api/players').then((d) => setPlayers(d.players)).catch(() => {});

  useEffect(() => {
    refreshPlayers();
  }, []);

  function flash(text, isError = false) {
    if (isError) setError(text);
    else setInfo(text);
    setTimeout(() => {
      setInfo(null);
      setError(null);
    }, 2500);
  }

  return (
    <div className="min-h-screen px-5 py-6 max-w-md mx-auto pb-12">
      <header className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <GhostButton onClick={() => navigate('/')}>Home</GhostButton>
      </header>

      {info && (
        <p className="mb-3 p-2 rounded-lg bg-[#22C55E]/15 text-[#22C55E] text-sm">{info}</p>
      )}
      {error && (
        <p className="mb-3 p-2 rounded-lg bg-[#EF4444]/15 text-[#EF4444] text-sm">{error}</p>
      )}

      <ProfileSection player={player} flash={flash} setBusy={setBusy} busy={busy} />

      <GroupsSection navigate={navigate} />

      <StatsSection navigate={navigate} />

      <ThemeSection theme={theme} setTheme={setTheme} />

      {player.isAdmin && (
        <AdminSection
          players={players}
          self={player}
          refreshPlayers={refreshPlayers}
          flash={flash}
          busy={busy}
          setBusy={setBusy}
        />
      )}

      <div className="mt-8">
        <SecondaryButton className="w-full" onClick={logout}>Logout</SecondaryButton>
      </div>
    </div>
  );
}

function GroupsSection({ navigate }) {
  return (
    <section className="mb-6">
      <p className="text-xs uppercase tracking-wider text-[#FAEEDA]/60 mb-2">My groups</p>
      <SecondaryButton className="w-full" onClick={() => navigate('/groups')}>
        Manage groups
      </SecondaryButton>
    </section>
  );
}

function StatsSection({ navigate }) {
  return (
    <section className="mb-6">
      <p className="text-xs uppercase tracking-wider text-[#FAEEDA]/60 mb-2">Stats and history</p>
      <div className="flex flex-col gap-2">
        <SecondaryButton onClick={() => navigate('/history')}>History</SecondaryButton>
        <SecondaryButton onClick={() => navigate('/stats')}>My stats</SecondaryButton>
        <SecondaryButton onClick={() => navigate('/leaderboard')}>Leaderboard</SecondaryButton>
      </div>
    </section>
  );
}

function ProfileSection({ player, flash, busy, setBusy }) {
  const [username, setUsername] = useState(player.username);
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');

  async function save() {
    if (pin && pin !== pin2) {
      flash('PINs do not match', true);
      return;
    }
    setBusy(true);
    try {
      const body = {};
      if (username && username !== player.username) body.username = username.trim();
      if (pin) body.pin = pin;
      if (Object.keys(body).length === 0) {
        flash('Nothing to save');
        return;
      }
      await api(`/api/players/${player.id}`, { method: 'PUT', body });
      flash('Profile updated');
      setPin('');
      setPin2('');
    } catch (err) {
      flash(err.message, true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mb-6">
      <p className="text-xs uppercase tracking-wider text-[#FAEEDA]/60 mb-2">Profile</p>
      <div className="flex flex-col gap-2">
        <Field label="Username" value={username} onChange={setUsername} />
        <Field
          label="New PIN (leave blank to keep)"
          value={pin}
          onChange={(v) => setPin(v.replace(/\D/g, '').slice(0, 4))}
          inputMode="numeric"
          type="password"
        />
        {pin && (
          <Field
            label="Confirm PIN"
            value={pin2}
            onChange={(v) => setPin2(v.replace(/\D/g, '').slice(0, 4))}
            inputMode="numeric"
            type="password"
          />
        )}
        <PrimaryButton disabled={busy} onClick={save}>Save profile</PrimaryButton>
      </div>
    </section>
  );
}

function ThemeSection({ theme, setTheme }) {
  return (
    <section className="mb-6">
      <p className="text-xs uppercase tracking-wider text-[#FAEEDA]/60 mb-2">Theme</p>
      <div className="flex gap-2">
        {['dark', 'light'].map((t) => (
          <button
            key={t}
            onClick={() => setTheme(t)}
            className={
              'flex-1 min-h-[44px] rounded-xl text-sm font-semibold capitalize ' +
              (theme === t
                ? 'bg-[#FAEEDA] text-[#0C447C]'
                : 'bg-[#082F58] text-[#FAEEDA] border border-[#FAEEDA]/20')
            }
          >
            {t}
          </button>
        ))}
      </div>
    </section>
  );
}

function AdminSection({ players, self, refreshPlayers, flash, busy, setBusy }) {
  const [newName, setNewName] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmReset, setConfirmReset] = useState(0);

  async function createPlayer() {
    if (!newName.trim() || !/^\d{4}$/.test(newPin)) {
      flash('Username and 4-digit PIN required', true);
      return;
    }
    setBusy(true);
    try {
      await api('/api/auth/register', {
        method: 'POST',
        body: { username: newName.trim(), pin: newPin },
      });
      setNewName('');
      setNewPin('');
      flash('Player created');
      refreshPlayers();
    } catch (err) {
      flash(err.message, true);
    } finally {
      setBusy(false);
    }
  }

  async function resetPlayerPin(playerId) {
    const newPin = window.prompt('New 4-digit PIN for this player:');
    if (!newPin || !/^\d{4}$/.test(newPin)) {
      flash('PIN must be 4 digits', true);
      return;
    }
    setBusy(true);
    try {
      await api(`/api/players/${playerId}/reset-pin`, {
        method: 'POST',
        body: { newPin },
      });
      flash(`PIN reset (tell them: ${newPin})`);
    } catch (err) {
      flash(err.message, true);
    } finally {
      setBusy(false);
    }
  }

  async function makeAdmin(playerId) {
    if (!window.confirm('Transfer admin rights? You will lose admin access.')) return;
    setBusy(true);
    try {
      await api(`/api/players/${playerId}/make-admin`, { method: 'POST' });
      flash('Admin transferred');
      refreshPlayers();
    } catch (err) {
      flash(err.message, true);
    } finally {
      setBusy(false);
    }
  }

  async function deletePlayer(player) {
    const games = player.gamesPlayed || 0;
    const warning =
      games > 0
        ? `${player.username} has ${games} game${games === 1 ? '' : 's'} of history. Delete anyway? Their game data will be removed too.`
        : `Delete ${player.username}?`;
    if (!window.confirm(warning)) return;
    setBusy(true);
    try {
      await api(`/api/players/${player.id}`, { method: 'DELETE' });
      flash('Player deleted');
      refreshPlayers();
    } catch (err) {
      flash(err.message, true);
    } finally {
      setBusy(false);
    }
  }

  async function renamePlayer(playerId, currentName) {
    const next = window.prompt('New display name:', currentName);
    if (next == null) return;
    const trimmed = next.trim();
    if (trimmed === '' || trimmed === currentName) return;
    setBusy(true);
    try {
      await api(`/api/players/${playerId}`, { method: 'PUT', body: { username: trimmed } });
      flash('Name updated');
      refreshPlayers();
    } catch (err) {
      flash(err.message, true);
    } finally {
      setBusy(false);
    }
  }

  async function upgradeGuest(playerId, name) {
    const pin = window.prompt(`Set a 4-digit PIN for ${name}. They can then log in.`);
    if (!pin) return;
    if (!/^\d{4}$/.test(pin)) {
      flash('PIN must be 4 digits', true);
      return;
    }
    setBusy(true);
    try {
      await api(`/api/players/${playerId}/upgrade`, { method: 'POST', body: { pin } });
      flash(`${name} upgraded to full account (PIN: ${pin})`);
      refreshPlayers();
    } catch (err) {
      flash(err.message, true);
    } finally {
      setBusy(false);
    }
  }

  async function resetAllData() {
    setBusy(true);
    try {
      await api('/api/admin/reset-data', { method: 'POST' });
      flash('All games and stats wiped');
      setConfirmReset(0);
    } catch (err) {
      flash(err.message, true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className="mb-6">
        <p className="text-xs uppercase tracking-wider text-[#FAEEDA]/60 mb-2">Add player (admin)</p>
        <div className="flex gap-2">
          <input
            placeholder="Username"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="flex-1 min-h-[44px] px-3 rounded-xl bg-[#082F58] border border-[#FAEEDA]/20 text-[#FAEEDA] outline-none"
          />
          <input
            placeholder="PIN"
            inputMode="numeric"
            maxLength={4}
            value={newPin}
            onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
            className="w-20 min-h-[44px] px-3 rounded-xl bg-[#082F58] border border-[#FAEEDA]/20 text-[#FAEEDA] outline-none text-center"
          />
        </div>
        <PrimaryButton className="w-full mt-2" disabled={busy} onClick={createPlayer}>
          Create player
        </PrimaryButton>
      </section>

      <section className="mb-6">
        <p className="text-xs uppercase tracking-wider text-[#FAEEDA]/60 mb-2">Manage players</p>
        <ul className="flex flex-col gap-2">
          {players.map((p) => (
            <li key={p.id} className="p-3 rounded-xl bg-[#082F58] border border-[#FAEEDA]/15">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium flex items-center gap-2 flex-wrap">
                  <span>{p.username}</span>
                  {p.isAdmin && (
                    <span className="text-[10px] uppercase tracking-wider text-[#FFD700]">Admin</span>
                  )}
                  {p.isGuest && (
                    <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-[#FAEEDA]/15 text-[#FAEEDA]/80 border border-[#FAEEDA]/30">
                      Guest
                    </span>
                  )}
                  {p.id === self.id && (
                    <span className="text-xs text-[#FAEEDA]/60">(you)</span>
                  )}
                </span>
              </div>
              <div className="flex gap-2 flex-wrap">
                {p.isGuest ? (
                  <>
                    <button
                      disabled={busy}
                      onClick={() => renamePlayer(p.id, p.username)}
                      className="min-h-[36px] px-3 rounded-lg text-xs bg-[#0C447C] border border-[#FAEEDA]/20"
                    >
                      Rename
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => upgradeGuest(p.id, p.username)}
                      className="min-h-[36px] px-3 rounded-lg text-xs bg-[#0C447C] border border-[#FAEEDA]/20"
                    >
                      Upgrade to full account
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      disabled={busy}
                      onClick={() => resetPlayerPin(p.id)}
                      className="min-h-[36px] px-3 rounded-lg text-xs bg-[#0C447C] border border-[#FAEEDA]/20"
                    >
                      Reset PIN
                    </button>
                    {!p.isAdmin && (
                      <button
                        disabled={busy}
                        onClick={() => makeAdmin(p.id)}
                        className="min-h-[36px] px-3 rounded-lg text-xs bg-[#0C447C] border border-[#FAEEDA]/20"
                      >
                        Make admin
                      </button>
                    )}
                  </>
                )}
                {p.id !== self.id && (
                  <button
                    disabled={busy}
                    onClick={() => deletePlayer(p)}
                    className="min-h-[36px] px-3 rounded-lg text-xs bg-[#7F1D1D]/80"
                  >
                    Delete
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-6 p-3 rounded-2xl border border-[#EF4444]/40 bg-[#7F1D1D]/15">
        <p className="text-xs uppercase tracking-wider text-[#EF4444] mb-1">Danger zone</p>
        <p className="text-sm mb-3">
          Wipe all games, rounds, sets, and throws. Player accounts are kept.
        </p>
        {confirmReset === 0 && (
          <DangerButton className="w-full" onClick={() => setConfirmReset(1)}>
            Reset all game data
          </DangerButton>
        )}
        {confirmReset === 1 && (
          <DangerButton className="w-full" onClick={() => setConfirmReset(2)}>
            Are you sure? Tap again to confirm.
          </DangerButton>
        )}
        {confirmReset === 2 && (
          <DangerButton className="w-full" disabled={busy} onClick={resetAllData}>
            Final tap. This deletes everything.
          </DangerButton>
        )}
        {confirmReset > 0 && (
          <button
            onClick={() => setConfirmReset(0)}
            className="w-full mt-2 text-xs text-[#FAEEDA]/70 underline"
          >
            Cancel
          </button>
        )}
      </section>
    </>
  );
}

function Field({ label, value, onChange, type = 'text', inputMode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-[#FAEEDA]/70">{label}</span>
      <input
        type={type}
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-[44px] px-3 rounded-xl bg-[#082F58] border border-[#FAEEDA]/20 text-[#FAEEDA] outline-none focus:border-[#FAEEDA]/60"
      />
    </label>
  );
}
