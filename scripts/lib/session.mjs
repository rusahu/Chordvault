export const DEMO_ACCOUNT = { username: 'demo', password: 'demopass123' };

/** Signs in through the API; the result is what the app stores as cv_user. */
export async function signIn(base, { username, password } = DEMO_ACCOUNT) {
  const res = await fetch(`${base}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error(`Sign-in failed: ${res.status}`);
  const { token, id, username: name, role } = await res.json();
  return { token, id, username: name, role };
}
