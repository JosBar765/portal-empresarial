export async function sessionCheck() {
  const res = await fetch('/api/auth.php?action=session_check');
  return res.json();
}

export function logout() {
  return fetch('/api/auth.php?action=logout');
}

export function refreshToken() {
  return fetch('/api/auth/refresh', { method: 'POST' });
}
