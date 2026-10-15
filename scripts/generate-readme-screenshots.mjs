import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { setTimeout } from 'node:timers/promises';
import { launchBrowser, newAppContext } from './lib/browser.mjs';
import { signIn } from './lib/session.mjs';

const base = process.env.CV_SCREENSHOT_BASE || 'http://127.0.0.1:3108';
const songId = process.env.CV_SCREENSHOT_SONG_ID;
const setlistId = process.env.CV_SCREENSHOT_SETLIST_ID;
if (!songId || !setlistId) throw new Error('Set CV_SCREENSHOT_SONG_ID and CV_SCREENSHOT_SETLIST_ID to public sample records in the disposable local instance.');
const output = fileURLToPath(new URL('../docs/screenshots/', import.meta.url));
mkdirSync(output, { recursive: true });
const browser = await launchBrowser(process.env.CV_SCREENSHOT_BROWSER_CHANNEL);

const DESKTOP = { width: 1280, height: 900 };
const PHONE = { width: 390, height: 844 };
const TABLET = { width: 768, height: 1024 };

async function capture(filename, route, scheme, { viewport = DESKTOP, user = null, open = null } = {}) {
  // Fresh contexts share the server's five-second burst window.
  await setTimeout(5100);
  const touch = viewport.width < 1024;
  const context = await newAppContext(browser, { account: user, storage: { cv_theme: scheme, cv_fontsize: '0' }, viewport, isMobile: touch, hasTouch: touch, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/${route}`);
  await page.locator(`html[data-mantine-color-scheme="${scheme}"]`).waitFor();
  await page.locator(route ? '.chord-sheet .lyrics:not(:empty)' : '.song-card').first().waitFor();
  if (open) await open(page);
  await page.evaluate(() => document.fonts.ready);
  if (route.includes('/play/')) await page.getByRole('button', { name: 'Fit', exact: true }).click();
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  if (errors.length) throw new Error(errors.join('\n'));
  await page.screenshot({ path: `${output}${filename}`, fullPage: !route.includes('/play/') });
  console.log(`Captured ${filename} (${scheme}, ${viewport.width}x${viewport.height})`);
  await context.close();
}

const openSetlists = async (page) => {
  await page.getByRole('button', { name: 'Setlists', exact: true }).click();
  await page.locator('.setlist-card').first().waitFor();
};
const singleColumn = page => page.getByRole('button', { name: 'Multi-column layout' }).click();
const openEditor = async (page) => {
  await page.getByRole('button', { name: /Edit$/ }).first().click();
  await page.locator('.editor-preview-wrap .lyrics:not(:empty)').first().waitFor();
};

try {
  const user = await signIn(base);
  await capture('browse.png', '', 'dark');
  await capture('song-view.png', `#song/${songId}`, 'dark', { open: singleColumn });
  await capture('song-view-light.png', `#song/${songId}`, 'light', { open: singleColumn });
  await capture('mobile-song-view.png', `#song/${songId}`, 'light', { viewport: PHONE });
  await capture('setlist-play.png', `#setlist/${setlistId}/play/0`, 'dark');
  await capture('setlist-play-light.png', `#setlist/${setlistId}/play/0`, 'light');
  await capture('tablet-setlist-play.png', `#setlist/${setlistId}/play/0`, 'light', { viewport: TABLET });
  await capture('setlists.png', '', 'light', { user, open: openSetlists });
  await capture('song-editor.png', `#song/${songId}`, 'dark', { user, open: openEditor });
} finally {
  await browser.close();
}
