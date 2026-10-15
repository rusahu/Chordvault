import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { DEMO_ACCOUNT, signIn } from './lib/session.mjs';

const base = process.env.CV_CHECK_BASE || 'http://localhost:3118';
const songId = process.env.CV_CHECK_SONG_ID || '2';
const account = await signIn(base, {
  username: process.env.CV_CHECK_USER || DEMO_ACCOUNT.username,
  password: process.env.CV_CHECK_PASSWORD || DEMO_ACCOUNT.password,
});
const browser = await chromium.launch({ ...(process.env.CV_CHECK_CHANNEL ? { channel: process.env.CV_CHECK_CHANNEL } : {}) });
try {
  for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    await context.addInitScript(({ account, theme }) => {
      localStorage.setItem('cv_user', JSON.stringify(account));
      localStorage.setItem('cv_theme', theme);
    }, { account, theme });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    await page.goto(`${base}/#song/${songId}`);
    await page.locator('.lyrics:not(:empty)').first().waitFor();
    await page.getByRole('button', { name: /Edit$/ }).first().click();
    const content = page.locator('.cm-content');
    await content.waitFor();
    const originalNode = await content.elementHandle();
    // Read CodeMirror's live state through its DOM tile, never modify the editor via test internals.
    const state = () => content.evaluate(el => {
      const view = el.cmTile.root.view;
      return { text: view.state.doc.toString(), selection: view.state.selection.toJSON() };
    });
    await page.waitForFunction(() => document.querySelector('.cm-content')?.cmTile?.root?.view.state.doc.toString().includes('{title:'));
    const before = await state();
    await content.click();
    await page.keyboard.press('ControlOrMeta+End');
    await page.keyboard.insertText('\n[C]Test grace 恩典');
    await page.keyboard.press('Shift+ArrowLeft');
    const edited = await state();
    assert(edited.text.endsWith('[C]Test grace 恩典'));
    const editTab = page.getByRole('tab', { name: 'Edit', exact: true });
    const previewTab = page.getByRole('tab', { name: 'Preview', exact: true });
    await previewTab.click();
    assert.equal(await content.isVisible(), false);
    await page.waitForFunction(() => document.querySelector('.editor-preview-wrap')?.textContent.includes('Test grace') && document.querySelector('.editor-preview-wrap')?.textContent.includes('恩典'));
    await content.evaluate(el => el.focus());
    assert.equal(await content.evaluate(el => el === document.activeElement), false);
    await previewTab.focus();
    await page.keyboard.press('ArrowLeft');
    assert.equal(await editTab.getAttribute('aria-selected'), 'true');
    assert.deepEqual(await state(), edited);
    for (const width of [1024, 390, 768, 390]) {
      await page.setViewportSize({ width, height: 844 });
      assert.equal(await content.isVisible(), true);
      assert.equal(await page.locator('.editor-preview-wrap').isVisible(), width >= 768);
      assert.equal(await page.locator('.cm-editor').count(), 1);
      assert(await content.evaluate((el, original) => el === original, originalNode));
      assert.deepEqual(await state(), edited);
    }
    await content.focus();
    await page.keyboard.press('ControlOrMeta+z');
    assert.equal((await state()).text, before.text);
    await context.close();
    console.log(`PASS ${theme}: linked panels, preview flush, hidden focus, arrow keys, selection, resize and undo`);
  }
} finally {
  await browser.close();
}
