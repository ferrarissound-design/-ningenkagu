import { test, expect } from '@playwright/test';

async function waitForOpeningApi(page) {
  await page.goto('/index.html');
  await page.waitForFunction(() => !!window.__ningenkaguOpening, null, { timeout: 15_000 });
}

test.describe('超短いオープニング', () => {
  test('初回起動ではオープニングとSKIPが表示される', async ({ page }) => {
    await waitForOpeningApi(page);

    await expect(page.locator('#openingIntro')).toBeVisible();
    await expect(page.locator('.nk-opening-skip')).toBeVisible();
    await expect(page.locator('#openingIntro')).toHaveAttribute('aria-label', /オープニング/);
    await expect(page.locator('.nk-opening-copy')).toContainText('ある日、カグミンは気づいた。');
  });

  test('SKIPすると視聴済みになり、次回ロードでは自動再生しない', async ({ page }) => {
    await waitForOpeningApi(page);
    await page.click('.nk-opening-skip');

    await expect(page.locator('#openingIntro')).toBeHidden();
    await expect.poll(async () => page.evaluate(() => localStorage.getItem('ningenkagu.openingSeen.v1'))).toBe('1');

    await page.reload();
    await page.waitForFunction(() => !!window.__ningenkaguOpening, null, { timeout: 15_000 });
    await expect(page.locator('#openingIntro')).toHaveCount(0);
    await expect(page.locator('#title')).toBeVisible();
  });

  test('ESCでもスキップできる', async ({ page }) => {
    await waitForOpeningApi(page);
    await page.keyboard.press('Escape');

    await expect(page.locator('#openingIntro')).toBeHidden();
    await expect.poll(async () => page.evaluate(() => window.__ningenkaguOpening.isActive())).toBe(false);
  });

  test('視聴済みでもreplayなら再生できる', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('ningenkagu.openingSeen.v1', '1'));
    await waitForOpeningApi(page);

    await expect(page.locator('#openingIntro')).toHaveCount(0);
    const started = await page.evaluate(() => window.__ningenkaguOpening.replay());
    expect(started).toBe(true);
    await expect(page.locator('#openingIntro')).toBeVisible();
    await page.evaluate(() => window.__ningenkaguOpening.skip());
  });

  test('オープニング中でも既存タイトルのゲーム開始処理を壊さない', async ({ page }) => {
    await waitForOpeningApi(page);
    await page.waitForFunction(() => !!window.__ningenkagu?.game, null, { timeout: 15_000 });

    // 演出レイヤ本体はpointer-events:none。既存E2Eやゲーム操作のイベント配線を奪わない。
    await page.click('#btnStart');
    await page.waitForFunction(() => window.__ningenkagu.game.state === 'playing');
    expect(await page.evaluate(() => window.__ningenkagu.game.state)).toBe('playing');
  });
});
