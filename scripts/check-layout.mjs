import { launchBrowser, newAppContext, signIn } from './lib/session.mjs';

const base = process.env.CV_CHECK_BASE || 'http://localhost:5173';
const setlistId = process.env.CV_CHECK_SETLIST_ID;
if (!setlistId) throw new Error('Set CV_CHECK_SETLIST_ID to a local setlist containing a long-line English song, a Chinese song and a long bilingual title.');

const viewports = [
  { name: 'phone-320', width: 320, height: 640, mobile: true },
  { name: 'phone-360', width: 360, height: 740, mobile: true },
  { name: 'phone', width: 390, height: 844, mobile: true },
  { name: 'below-640', width: 639, height: 900, mobile: true },
  { name: 'above-640', width: 641, height: 900, mobile: true },
  { name: 'tablet-portrait', width: 768, height: 1024, mobile: true },
  { name: 'small-landscape', width: 960, height: 600, mobile: true },
  { name: 'tablet-landscape', width: 1024, height: 768, mobile: true },
  { name: 'desktop', width: 1440, height: 900, mobile: false },
];

function inspect() {
  const wrap = document.querySelector('.chord-sheet-wrap');
  const output = wrap.querySelector('#chord-output');
  const dock = document.querySelector('.playback-dock');
  const rows = [...document.querySelectorAll('#chord-output .row')].filter((row) => !row.querySelector('h3.label, .section-label'));
  const countWrapped = () => rows.filter((row) => {
    const tallest = Math.max(...[...row.children].map((c) => c.getBoundingClientRect().height), 0);
    return tallest > 0 && row.getBoundingClientRect().height > tallest * 1.5;
  }).length;
  const wrapped = countWrapped();

  // Does any size and column count fit the screen without wrapping? If not, Fit
  // is allowed to fall back to a wrapped layout and that is reported, not failed.
  const dockH = dock ? dock.getBoundingClientRect().height : 0;
  const avail = () => Math.min(innerHeight, visualViewport.height) - (output.getBoundingClientRect().top + scrollY) - dockH - 24;
  const twoCol = wrap.classList.contains('two-col');
  const scale = wrap.style.getPropertyValue('--font-scale');
  let cleanFitExists = false;
  for (let size = 3; size >= -3 && !cleanFitExists; size--) {
    for (const two of innerWidth >= 640 ? [true, false] : [false]) {
      wrap.classList.toggle('two-col', two);
      wrap.style.setProperty('--font-scale', String(1 + size * 0.12));
      if (output.scrollHeight <= avail() && wrap.scrollWidth <= wrap.clientWidth && !countWrapped()) { cleanFitExists = true; break; }
    }
  }
  wrap.classList.toggle('two-col', twoCol);
  if (scale) wrap.style.setProperty('--font-scale', scale); else wrap.style.removeProperty('--font-scale');

  window.scrollTo(0, document.documentElement.scrollHeight);
  const last = rows.at(-1)?.getBoundingClientRect().bottom ?? 0;
  const dockTop = dock ? dock.getBoundingClientRect().top : window.innerHeight;
  const title = document.querySelector('.playback-title-main');
  const bar = document.querySelector('.playback-topbar');
  return {
    barOverflow: bar.scrollWidth > bar.clientWidth,
    sidePad: Math.round(parseFloat(getComputedStyle(wrap).paddingLeft)),
    sheetOverflow: wrap.scrollWidth > wrap.clientWidth,
    pageOverflow: document.documentElement.scrollWidth > window.innerWidth,
    wrappedChordRows: wrapped,
    cleanFitExists,
    lastLineHidden: last > dockTop + 1,
    hasDock: !!dock,
    titleTruncated: title ? getComputedStyle(title).textOverflow === 'ellipsis' : false,
    dockOverlap: (() => {
      const items = dock ? [...dock.querySelectorAll('button')].filter((b) => b.offsetParent).map((b) => b.getBoundingClientRect()) : [];
      const clipped = dock ? [...dock.querySelectorAll('button')].some((b) => b.offsetParent && b.scrollWidth > b.clientWidth + 1) : false;
      const overlaps = items.some((a, i) => items.slice(i + 1).some((b) => a.right > b.left + 1 && b.right > a.left + 1));
      return overlaps || clipped || (dock ? dock.scrollWidth > dock.clientWidth + 1 : false);
    })(),
  };
}

const browser = await launchBrowser();
let failures = 0;
for (const scheme of ['light', 'dark']) {
  for (const vp of viewports) {
    for (const index of [0, 1, 2]) {
      const context = await newAppContext(browser, { storage: { cv_theme: scheme }, viewport: { width: vp.width, height: vp.height }, isMobile: vp.mobile, hasTouch: vp.mobile });
      const page = await context.newPage();
      await page.goto(`${base}/#setlist/${setlistId}/play/${index}`);
      await page.locator('.chord-sheet .lyrics:not(:empty)').first().waitFor();
      await page.evaluate(() => document.fonts.ready);
      await page.getByRole('button', { name: 'Fit', exact: true }).click();
      const r = await page.evaluate(inspect);
      const problems = [];
      if (index === 0) {
        await page.getByTestId('key-display').click();
        const clippedKeys = await page.locator('.key-pill .mantine-Button-label').evaluateAll((labels) => labels
          .filter((label) => label.scrollWidth > label.clientWidth + 1)
          .map((label) => label.textContent));
        if (clippedKeys.length) problems.push(`key labels clipped: ${clippedKeys.join(', ')}`);
        await page.keyboard.press('Escape');
      }
      if (r.sheetOverflow) problems.push('sheet scrolls sideways');
      if (r.pageOverflow) problems.push('page scrolls sideways');
      if (r.barOverflow) problems.push('top bar controls cut off');
      const expectedPad = vp.width >= 1024 ? 48 : vp.width >= 640 ? 20 : 18;
      if (r.sidePad !== expectedPad) problems.push(`sheet side padding ${r.sidePad}px, spec ${expectedPad}px`);
      const notes = [];
      if (r.wrappedChordRows) (r.cleanFitExists ? problems : notes).push(`${r.wrappedChordRows} wrapped chord rows${r.cleanFitExists ? '' : ' (no layout fits without wrapping)'}`);
      if (r.lastLineHidden) problems.push('last line under the dock');
      if (r.hasDock !== vp.width < 1024) problems.push(`dock ${r.hasDock ? 'shown' : 'missing'}`);
      if (r.titleTruncated) problems.push('title truncated');
      if (r.dockOverlap) problems.push('dock buttons overlap or clip');
      const status = problems.length ? 'FAIL' : notes.length ? 'warn' : 'ok  ';
      const detail = [...problems, ...notes];
      console.log(`${status} ${scheme} ${vp.name} song ${index + 1}${detail.length ? ': ' + detail.join(', ') : ''}`);
      failures += problems.length ? 1 : 0;
      await context.close();
    }
  }
}
// Playback opened from inside the app runs the view-enter animation first; the
// dock must still sit on the bottom of the screen, not after the song.
// Touch screens also need 44px targets on every playback control.
for (const vp of viewports.filter((v) => v.mobile)) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.goto(`${base}/#setlist/${setlistId}`);
  await page.getByRole('button', { name: 'Open', exact: true }).click();
  await page.locator('.chord-sheet .lyrics:not(:empty)').first().waitFor();
  await page.waitForTimeout(400);
  const problems = await page.evaluate(() => {
    const out = [];
    const dock = document.querySelector('.playback-dock');
    if (dock && Math.abs(dock.getBoundingClientRect().bottom - innerHeight) > 1) out.push(`dock bottom at ${Math.round(dock.getBoundingClientRect().bottom)}, screen ends at ${innerHeight}`);
    const small = [...document.querySelectorAll('.playback-topbar button, .playback-topbar a, .playback-dock button')]
      .filter((b) => b.offsetParent && Math.min(b.getBoundingClientRect().width, b.getBoundingClientRect().height) < 44)
      .map((b) => `${b.getAttribute('aria-label') || b.textContent.trim()} ${Math.round(b.getBoundingClientRect().height)}px`);
    if (small.length) out.push(`small targets: ${small.join(', ')}`);
    return out;
  });
  await page.getByRole('button', { name: 'Setlist defaults' }).click();
  const smallInPanel = await page.locator('.mantine-Popover-dropdown button').evaluateAll((els) => els
    .filter((b) => Math.min(b.getBoundingClientRect().width, b.getBoundingClientRect().height) < 44)
    .map((b) => b.getAttribute('aria-label') || b.textContent.trim()));
  if (smallInPanel.length) problems.push(`small defaults targets: ${smallInPanel.join(', ')}`);
  console.log(`${problems.length ? 'FAIL' : 'ok  '} in-app ${vp.name}${problems.length ? ': ' + problems.join('; ') : ''}`);
  failures += problems.length ? 1 : 0;
  await context.close();
}
// Song metadata badges share a height and type scale without overflowing cards.
for (const width of [390, 768, 1280]) {
  const touch = width < 1024;
  const context = await browser.newContext({ viewport: { width, height: 900 }, isMobile: touch, hasTouch: touch });
  const page = await context.newPage();
  await page.goto(`${base}/`);
  await page.locator('.song-card').first().waitFor();
  const problems = await page.evaluate(() => {
    const out = [];
    if (document.documentElement.scrollWidth > innerWidth) out.push('page scrolls sideways');
    for (const card of document.querySelectorAll('.song-card')) {
      if (card.scrollWidth > card.clientWidth + 1) out.push(`card overflows: ${card.querySelector('.song-card-title')?.textContent}`);
    }
    const badges = [...document.querySelectorAll('.song-card .mantine-Badge-root')];
    if (!badges.length) out.push('no song badges found');
    const sizes = new Set(badges.map((badge) => {
      const style = getComputedStyle(badge);
      return `${badge.getBoundingClientRect().height}/${style.fontSize}/${style.fontWeight}`;
    }));
    if (sizes.size > 1) out.push(`inconsistent badge sizes: ${[...sizes].join(', ')}`);
    return out;
  });
  console.log(`${problems.length ? 'FAIL' : 'ok  '} browse ${width}${problems.length ? ': ' + problems.join('; ') : ''}`);
  failures += problems.length ? 1 : 0;
  await context.close();
}
// Signed-in phone pages: nav labels whole, search on one row, card actions inside
// their card, sheet padding as designed, setlist titles with room to read.
const { CV_CHECK_USER: user, CV_CHECK_PASSWORD: password, CV_CHECK_SONG_ID: songId } = process.env;
if (user && password && songId) {
  const account = await signIn(base, { username: user, password });
  const pages = [['songs', '', null], ['setlists', '', 'Setlists'], ['song', `#song/${songId}`, null], ['setlist', `#setlist/${setlistId}`, null]];
  for (const width of [360, 384, 412, 768]) {
    for (const [name, route, click] of pages) {
      const context = await newAppContext(browser, { account, viewport: { width, height: 800 }, isMobile: true, hasTouch: true });
      const page = await context.newPage();
      await page.goto(`${base}/${route}`);
      if (click) await page.getByRole('button', { name: click, exact: true }).click();
      await page.locator('.song-card, .setlist-card, .chord-sheet .lyrics:not(:empty)').first().waitFor();
      await page.evaluate(() => document.fonts.ready);
      const problems = await page.evaluate(() => {
        const out = [];
        const shown = (e) => e.getClientRects().length > 0;
        if (document.documentElement.scrollWidth > innerWidth) out.push('page scrolls sideways');
        const cut = [...document.querySelectorAll('#nav button, #nav .mantine-Button-label')].filter((e) => shown(e) && e.scrollWidth > e.clientWidth + 1);
        if (cut.length) out.push(`nav labels cut: ${[...new Set(cut.map((e) => e.textContent.trim()))].join(', ')}`);
        const row = document.querySelector('.search-row');
        const input = row?.querySelector('input');
        const button = row ? [...row.querySelectorAll('button')].find((b) => /search/i.test(b.textContent)) : null;
        if (input && button && Math.abs(input.getBoundingClientRect().top - button.getBoundingClientRect().top) > 6) out.push('search button not beside the field');
        const field = input?.closest('.mantine-Input-wrapper, .mantine-TextInput-wrapper') ?? input;
        const uneven = row && field ? [...row.querySelectorAll(':scope > button, :scope > .mantine-ActionIcon-root')].filter((b) => Math.abs(b.getBoundingClientRect().height - field.getBoundingClientRect().height) > 1) : [];
        if (uneven.length) out.push(`search row buttons not the field's height: ${uneven.map((b) => b.textContent.trim() || b.getAttribute('aria-label')).join(', ')}`);
        const cramped = [...document.querySelectorAll('.song-grid .song-card-title')].filter((t) => t.getBoundingClientRect().width < 180);
        if (cramped.length) out.push(`card titles squeezed to ${Math.round(cramped[0].getBoundingClientRect().width)}px: ${cramped[0].textContent.trim().slice(0, 20)}`);
        for (const card of document.querySelectorAll('.song-card, .setlist-card')) {
          const actions = card.querySelector('.song-card-actions');
          if (!actions) continue;
          const edge = card.getBoundingClientRect().right - parseFloat(getComputedStyle(card).paddingRight);
          if (actions.getBoundingClientRect().right > edge + 1) { out.push('card actions run into the border'); break; }
        }
        const sheet = document.querySelector('.chord-sheet-wrap');
        if (sheet && innerWidth <= 900 && parseFloat(getComputedStyle(sheet).paddingLeft) !== 16) out.push(`sheet padding ${getComputedStyle(sheet).paddingLeft}, want 16px`);
        const narrow = [...document.querySelectorAll('.setlist-song-item .song-card-title')].filter((t) => t.getBoundingClientRect().width < 160);
        if (narrow.length) out.push(`setlist titles squeezed to ${Math.round(narrow[0].getBoundingClientRect().width)}px`);
        const tiny = [...document.querySelectorAll('.setlist-song-item button')].filter((b) => b.offsetParent && Math.min(b.getBoundingClientRect().width, b.getBoundingClientRect().height) < 44);
        if (tiny.length) out.push(`setlist entry targets under 44px: ${[...new Set(tiny.map((b) => b.getAttribute('aria-label') || b.textContent.trim()))].join(', ')}`);
        const toggle = document.querySelector('#setlist-visibility')?.closest('.mantine-Switch-root');
        const dateField = document.querySelector('#setlist-date')?.closest('.mantine-TextInput-root');
        if (toggle && dateField) {
          const mid = (e) => { const r = e.getBoundingClientRect(); return r.top + r.height / 2; };
          if (dateField.getBoundingClientRect().height > 48) out.push(`date field ${Math.round(dateField.getBoundingClientRect().height)}px tall, label not inline`);
          if (Math.abs(mid(toggle) - mid(dateField)) > 4) out.push('public toggle not level with the date field');
        }
        return out;
      });
      console.log(`${problems.length ? 'FAIL' : 'ok  '} signed-in ${name} ${width}${problems.length ? ': ' + problems.join('; ') : ''}`);
      failures += problems.length ? 1 : 0;
      await context.close();
    }
  }
  // Editor action bar: pinned to the top after scrolling while the nav scrolls away, fits, 44px targets on touch.
  for (const width of [390, 768, 1280]) {
    const touch = width < 1024;
    const context = await newAppContext(browser, { account, viewport: { width, height: 700 }, isMobile: touch, hasTouch: touch });
    const page = await context.newPage();
    await page.goto(`${base}/#song/${songId}`);
    await page.locator('.chord-sheet .lyrics:not(:empty)').first().waitFor();
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(200);
    const navPinnedOnSong = await page.evaluate(() => document.querySelector('#nav').getBoundingClientRect().bottom > 0);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.getByRole('button', { name: /Edit$/ }).first().click();
    await page.locator('.editor-action-bar').waitFor();
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(200);
    const problems = await page.evaluate((isTouch) => {
      const out = [];
      const bar = document.querySelector('.editor-action-bar');
      const top = bar.getBoundingClientRect().top;
      if (top < 0 || top > 8) out.push(`bar not pinned to the top (top ${Math.round(top)})`);
      if (document.querySelector('#nav').getBoundingClientRect().bottom > 0) out.push('nav pinned in the editor');
      if (bar.scrollWidth > bar.clientWidth + 1) out.push('bar overflows');
      if (document.documentElement.scrollWidth > innerWidth) out.push('page scrolls sideways');
      if (isTouch) {
        const small = [...bar.querySelectorAll('button')].filter((b) => b.offsetParent && Math.min(b.getBoundingClientRect().width, b.getBoundingClientRect().height) < 44);
        if (small.length) out.push(`small targets: ${small.map((b) => b.getAttribute('aria-label') || b.textContent.trim()).join(', ')}`);
      }
      return out;
    }, touch);
    if (navPinnedOnSong) problems.push('nav pinned on the song page');
    console.log(`${problems.length ? 'FAIL' : 'ok  '} editor ${width}${problems.length ? ': ' + problems.join('; ') : ''}`);
    failures += problems.length ? 1 : 0;
    await context.close();
  }
}
await browser.close();
process.exit(failures ? 1 : 0);
