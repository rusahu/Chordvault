/* global localStorage */
const { launchBrowser } = require('../scripts/lib/browser.mjs');
const { setTimeout: sleep } = require('node:timers/promises');

async function run() {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3100';
  const browser = await launchBrowser(process.env.PLAYWRIGHT_CHANNEL);
  const page = await browser.newPage();
  const consoleErrors = [];
  const missingResources = [];
  const apiRequests = {};

  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) {
      for (const key in apiRequests) {
        delete apiRequests[key];
      }
    }
  });

  page.on('request', (req) => {
    const url = req.url();
    if (url.includes('/api/')) {
      apiRequests[url] = (apiRequests[url] || 0) + 1;
      if (apiRequests[url] > 3) {
        console.error(`[Browser Error]: Infinite request loop detected on ${url} (${apiRequests[url]} requests)`);
        consoleErrors.push(`Infinite request loop detected on ${url}`);
      }
    }
  });

  page.on('console', (msg) => {
    const text = msg.text();
    console.log(`[Browser Console ${msg.type()}]:`, text);
    const ignorable404 = text.includes('Failed to load resource') || text.includes('/locales/') || text.includes('favicon.ico');
    if (msg.type() === 'error' && !ignorable404) {
      consoleErrors.push(msg.text());
    }
  });
  page.on('pageerror', (err) => {
    console.error('[Browser PageError]:', err.stack || err.message);
    consoleErrors.push(err.message);
  });
  page.on('response', (res) => {
    if (res.status() === 404) {
      console.log('[Browser 404]:', res.url());
      missingResources.push(res.url());
    }
  });

  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('#nav', { state: 'visible', timeout: 10000 });
  await page.waitForSelector('#app', { state: 'attached', timeout: 10000 });

  const appText = await page.locator('#app').innerText();
  if (!appText || !appText.trim()) {
    throw new Error('Main app container rendered empty content.');
  }

  // --- Local Setlist & Navigation Smoke Test ---
  console.log('Running Local Setlist Navigation Smoke Test...');
  
  // 1. Navigate to local setlists tab via navigation bar and tabs
  await page.goto(baseUrl + '/', { waitUntil: 'domcontentloaded', timeout: 10000 });
  await page.locator('#nav-links').getByRole('button', { name: 'Setlists', exact: true }).click();
  await page.getByText('My Setlists', { exact: true }).click();
  await page.waitForSelector('button:has-text("New Setlist")', { state: 'visible', timeout: 10000 });
  
  // 2. Open new setlist dialog
  const btn = page.locator('button:has-text("New Setlist")');
  console.log('Found button text:', await btn.innerText());
  await btn.click();
  
  // 3. Fill and Create
  await page.getByRole('dialog').getByRole('textbox', { name: 'Setlist name' }).fill('Smoke Test Local Setlist');
  await page.getByRole('button', { name: 'Create setlist', exact: true }).click();
  
  // 4. Verify we navigated to the setlist edit page
  await page.waitForURL(/.*#setlist\/local_\w+$/, { timeout: 10000 });
  const setlistUrl = page.url();
  console.log('Created local setlist at:', setlistUrl);
  
  // 5. Test Logo navigation (checks if we get stuck in a hash loop)
  await page.click('.nav-brand');
  await page.waitForURL(baseUrl + '/', { timeout: 5000 });
  await page.locator('#nav-links').getByRole('button', { name: 'Songs', exact: true }).waitFor({ state: 'visible', timeout: 5000 });
  await page.locator('#setlist-name-input').waitFor({ state: 'hidden', timeout: 5000 });
  console.log('Logo navigation succeeded (hash cleared).');
  
  // 6. Go back to the setlist edit view
  const storageBefore = await page.evaluate(() => localStorage.getItem('cv_local_setlists'));
  console.log('localStorage before reload:', storageBefore);
  
  await page.goto(setlistUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
  
  const storageAfter = await page.evaluate(() => localStorage.getItem('cv_local_setlists'));
  console.log('localStorage after reload:', storageAfter);
  
  console.log('Navigated to setlistUrl, current URL:', page.url());
  try {
    await page.waitForSelector('button:has-text("Add Song")', { state: 'visible', timeout: 5000 });
  } catch (err) {
    console.log('Timeout waiting for Add Song. Current URL:', page.url());
    console.log('Body HTML:', await page.locator('body').innerHTML());
    throw err;
  }
  
  // 7. Add a song if any exist
  // Separate anonymous navigation phases across the production 10 requests / 5 seconds burst window.
  await sleep(5100);
  const songsResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/songs/public');
  try {
    await page.click('button:has-text("Add Song")', { timeout: 5000 });
  } catch (err) {
    console.log('Timeout clicking Add Song. Current URL:', page.url());
    console.log('Body HTML:', await page.locator('body').innerHTML());
    throw err;
  }
  const picker = page.getByRole('dialog', { name: 'Add a Song', exact: true });
  await picker.waitFor({ state: 'visible', timeout: 5000 });
  const songsResult = await songsResponse;
  if (!songsResult.ok()) throw new Error(`Public song picker request failed: HTTP ${songsResult.status()}`);
  const publicSongs = await songsResult.json();
  const songCards = picker.locator('.song-card[role="button"]');
  const songCount = publicSongs.length;
  if (songCount > 0) {
    console.log(`Found ${songCount} public songs in picker. Adding the first one...`);
    const versionsResponse = publicSongs[0].version_count > 1
      ? page.waitForResponse(response => /\/api\/songs\/\d+\/versions$/.test(new URL(response.url()).pathname) && response.status() === 200)
      : null;
    await songCards.first().click();
    if (versionsResponse) {
      await versionsResponse;
      await picker.locator('select').selectOption({ index: 1 });
    }
    
    // Wait for modal to close and song list to show
    await page.waitForSelector('.setlist-song-item', { state: 'visible', timeout: 5000 });
    
    // 8. Click the song in the setlist to play it
    await page.locator('.setlist-song-item').first().click();
    await page.waitForURL(/#setlist\/local_\w+\/play(?:\/\d+)?$/, { timeout: 5000 });
    console.log('Play navigation succeeded.');
    
    // 9. Exit the player
    await page.click('button.btn-exit');
    await page.waitForURL(/.*#setlist\/local_\w+$/, { timeout: 5000 });
    console.log('Exit navigation succeeded.');
  } else {
    console.log('No public songs available. Closing picker...');
    await picker.locator('button.mantine-Modal-close').click();
    await picker.waitFor({ state: 'hidden', timeout: 5000 });
  }

  // 10. Clean up (Delete the local setlist)
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  const confirmation = page.getByRole('dialog').filter({ hasText: 'Delete this setlist?' });
  await confirmation.getByRole('button', { name: 'Confirm', exact: true }).click();
  await page.waitForURL(baseUrl + '/#public-setlists', { timeout: 5000 });
  console.log('Cleaned up smoke test local setlist.');
  
  // 11. Test Sign In Page Navigation
  console.log('Testing Sign In page navigation...');
  const signInButton = page.locator('#nav-links').getByRole('button', { name: 'Sign in', exact: true });
  await signInButton.waitFor({ state: 'visible', timeout: 10000 });
  await signInButton.click();
  await page.waitForSelector('#auth-submit', { state: 'visible', timeout: 10000 });

  const unexpected404 = missingResources.filter((url) => {
    if (url.endsWith('/favicon.ico')) return false;
    if (/\/locales\/[a-zA-Z-]+\.json$/.test(url)) return false;
    return true;
  });

  if (consoleErrors.length > 0 || unexpected404.length > 0) {
    throw new Error(`Console errors found:\n${consoleErrors.join('\n')}\nUnexpected 404 resources:\n${unexpected404.join('\n')}`);
  }

  await browser.close();
  console.log('Smoke test passed.');
}

run().catch((err) => {
  console.error(err.stack || err.message || String(err));
  process.exit(1);
});
