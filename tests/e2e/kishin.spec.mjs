import { test, expect } from '@playwright/test';

async function waitForApp(page) {
  await page.goto('/index.html');
  await page.waitForFunction(() => !!window.__ningenkagu, null, { timeout: 15_000 });
}

async function unlockKishin(page, stageIndex = 0) {
  await page.addInitScript(({ stageIndex }) => {
    localStorage.setItem('ningenkagu.completed', '1');
    localStorage.setItem('ningenkagu.stageIndex', String(stageIndex));
  }, { stageIndex });
  await waitForApp(page);
}

test.describe('鬼神モード', () => {
  test('ALL CLEAR前は封印され、達成後に選択できる', async ({ page }) => {
    await waitForApp(page);

    await expect(page.locator('#btnKishin')).toBeVisible();
    await expect(page.locator('#btnKishin')).toBeDisabled();
    await expect(page.locator('#btnKishin')).toContainText('🔒 鬼神モード');

    await page.evaluate(() => localStorage.setItem('ningenkagu.completed', '1'));
    await page.reload();
    await page.waitForFunction(() => !!window.__ningenkagu, null, { timeout: 15_000 });

    await expect(page.locator('#btnKishin')).toBeEnabled();
    await page.click('#btnKishin');
    await expect(page.locator('#cardKishin')).toBeVisible();
    await page.click('[data-game-mode="kishin"]');
    await expect(page.locator('#btnStart')).toContainText('🔥 鬼神モード開始');
  });

  test('1戦で3つの鬼相へ変貌し、おとりは1回だけ', async ({ page }) => {
    await unlockKishin(page);
    await page.click('#btnKishin');
    await page.click('[data-game-mode="kishin"]');
    await page.click('#btnStart');
    await page.waitForFunction(() => window.__ningenkagu.game.state === 'playing');

    const first = await page.evaluate(() => ({
      id: window.__ningenkagu.game.oni.personality.id,
      mode: window.__ningenkagu.game.mode,
      decoys: window.__ningenkagu.game.decoyUses,
    }));
    expect(first.mode).toBe('kishin');
    expect(first.decoys).toBe(1);

    await page.evaluate(() => { window.__ningenkagu.game.timeLeft = 39.8; });
    await page.waitForFunction(() => window.__ningenkagu.game.modeShiftIndex >= 1);
    const second = await page.evaluate(() => window.__ningenkagu.game.oni.personality.id);

    await page.evaluate(() => { window.__ningenkagu.game.timeLeft = 19.8; });
    await page.waitForFunction(() => window.__ningenkagu.game.modeShiftIndex >= 2);
    const third = await page.evaluate(() => window.__ningenkagu.game.oni.personality.id);

    expect(new Set([first.id, second, third]).size).toBe(3);
  });

  test('鬼神クリアをステージ別に保存し、タイトルのステージへ炎が付く', async ({ page }) => {
    await unlockKishin(page);
    await page.click('#btnKishin');
    await page.click('[data-game-mode="kishin"]');
    await page.click('#btnStart');
    await page.waitForFunction(() => window.__ningenkagu.game.state === 'playing');

    await page.evaluate(() => window.__ningenkagu.game.win());
    await expect(page.locator('#resultTitle')).toHaveText('鬼神 CLEAR!');
    expect(await page.evaluate(() => localStorage.getItem('ningenkagu.kishinClear.living'))).toBe('1');

    await page.click('#btnResultTitle');
    await expect(page.locator('[data-stage="0"]')).toContainText('🔥');
    await expect(page.locator('#btnKishin')).toContainText('1/5');
  });

  test('全5面の最後を埋めるとKISHIN MASTERになる', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('ningenkagu.completed', '1');
      localStorage.setItem('ningenkagu.stageIndex', '4');
      for (const id of ['living', 'classroom', 'artroom', 'library']) {
        localStorage.setItem('ningenkagu.kishinClear.' + id, '1');
      }
    });
    await waitForApp(page);

    await page.click('#btnKishin');
    await page.click('[data-game-mode="kishin"]');
    await page.click('#btnStart');
    await page.waitForFunction(() => window.__ningenkagu.game.state === 'playing');

    await page.evaluate(() => window.__ningenkagu.game.win());
    await expect(page.locator('#resultTitle')).toHaveText('KISHIN MASTER!');
    await expect(page.locator('#resultNote')).toContainText('全5ステージ鬼神制覇');

    await page.click('#btnResultTitle');
    await page.click('#btnKishin');
    await expect(page.locator('#kishinMasterBadge')).toBeVisible();
    await expect(page.locator('#kishinProgress')).toHaveText('鬼神制覇 5/5');
  });
});
