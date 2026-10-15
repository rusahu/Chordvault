import { createRequire } from 'node:module';
import { chromium } from 'playwright';

export const { DEMO_ACCOUNT } = createRequire(import.meta.url)('../../shared/public-constants.json');

/** The account a check script signs in as: CV_CHECK_USER / CV_CHECK_PASSWORD, else the demo account. */
export const scriptCredentials = () => ({
  username: process.env.CV_CHECK_USER || DEMO_ACCOUNT.username,
  password: process.env.CV_CHECK_PASSWORD || DEMO_ACCOUNT.password,
});

export const launchBrowser = (channel = process.env.CV_CHECK_CHANNEL) => chromium.launch(channel ? { channel } : {});

/** A browser context whose pages start with these localStorage values, signed in as `account` when given. */
export async function newAppContext(browser, { account, storage = {}, ...options } = {}) {
  const context = await browser.newContext(options);
  const values = account ? { ...storage, cv_user: JSON.stringify(account) } : storage;
  await context.addInitScript(entries => { for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, value); }, values);
  return context;
}

/** Signs in through the API; the result is what the app stores as cv_user. */
export async function signIn(base, { username, password } = DEMO_ACCOUNT) {
  const res = await fetch(`${base}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error(`Sign-in failed: ${res.status}`);
  const { token, id, username: name, role } = await res.json();
  return { token, id, username: name, role };
}
