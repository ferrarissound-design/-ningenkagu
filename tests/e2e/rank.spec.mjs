import { test, expect } from '@playwright/test';

async function freshTitle(page) {
  await page.addInitScript(() => {
    localStorage.setItem('ningenkagu.stageIndex', '0');
    localStorage.removeItem('ningenkagu.rank.living');
    localStorage.removeItem('ningenkagu.best.living');
  });
  await page.goto('/index.html');
  await page.waitForFunction(() => !!window.__ningenkagu, null, { timeout: 15_000 });
}

test.describe('クリア評価ランク', () => {
  test('S評価を保存し、タイトルのステージ選択にもベストランクを表示する', async ({ page }) => {
    await freshTitle(page);
    await expect(page.locator('#selStageRank')).toHaveText('-');

    await page.click('#btnStart');
    await page.waitForFunction(() => window.__ningenkagu.game.state === 'playing');

    // win() が生存ボーナス300を加えるので、合計2400になるよう事前スコアを2100にする。
    await page.evaluate(() => {
      const g = window.__ningenkagu.game;
      g.score = 2100;
      g.scoreSeen = 2100;
      g.win();
    });

    await expect(page.locator('#result')).toBeVisible();
    await expect(page.locator('#resultRank')).toHaveText('S');
    expect(await page.evaluate(() => localStorage.getItem('ningenkagu.rank.living'))).toBe('S');

    await page.click('#btnResultTitle');
    await expect(page.locator('#title')).toBeVisible();
    await expect(page.locator('#selStageRank')).toHaveText('S');
    await expect(page.locator('[data-stage="0"]')).toContainText('S');
  });

  test('敗北時は高得点でも評価ランクを保存しない', async ({ page }) => {
    await freshTitle(page);
    await page.click('#btnStart');
    await page.waitForFunction(() => window.__ningenkagu.game.state === 'playing');

    await page.evaluate(() => {
      const g = window.__ningenkagu.game;
      g.score = 9999;
      g.scoreSeen = 9999;
      g.lose();
    });

    await expect(page.locator('#result')).toBeVisible();
    await expect(page.locator('#resultRank')).toHaveText('—');
    expect(await page.evaluate(() => localStorage.getItem('ningenkagu.rank.living'))).toBe(null);
  });
});
