// Invite token stashed while an anonymous visitor registers or logs in,
// so the join can finish once they are authenticated.
const KEY = 'pt_pending_invite';

export function getPendingInvite() {
  return localStorage.getItem(KEY) || null;
}

export function setPendingInvite(token) {
  localStorage.setItem(KEY, token);
}

export function clearPendingInvite() {
  localStorage.removeItem(KEY);
}
