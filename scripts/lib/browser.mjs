import { chromium } from 'playwright';

// Kept apart from session.mjs: the Docker image ships session.mjs for the demo seed but not playwright.
export const launchBrowser = (channel = process.env.CV_CHECK_CHANNEL) => chromium.launch(channel ? { channel } : {});

/** A browser context whose pages start with these localStorage values, signed in as `account` when given. */
export async function newAppContext(browser, { account, storage = {}, ...options } = {}) {
  const context = await browser.newContext(options);
  const values = account ? { ...storage, cv_user: JSON.stringify(account) } : storage;
  await context.addInitScript(entries => { for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, value); }, values);
  return context;
}
