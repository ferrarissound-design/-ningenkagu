import { test, expect } from '@playwright/test';

async function waitForApp(page) {
  await page.goto('/index.html');
  await page.waitForFunction(() => !!window.__ningenkagu, null, { timeout: 15_000 });
}

test.describe('大型アップデートの動的システム', () => {
  test('通常プレイでも異変を強制発生でき、専用演出と補正が出る', async ({ page }) => {
    await waitForApp(page);
    await page.click('#btnStart');
    await page.waitForFunction(() => window.__ningenkagu.game.state === 'playing');
    await page.evaluate(() => window.__ningenkagu.hud.hideNotice());

    const started = await page.evaluate(() => window.__ningenkagu.triggerAnomaly());
    expect(started).toBe(true);

    const state = await page.evaluate(() => ({
      info: window.__ningenkagu.anomalyInfo(),
      fxClass: document.getElementById('majorFx')?.className || '',
    }));
    expect(state.info.active).not.toBeNull();
    expect(state.info.count).toBe(1);
    expect(state.fxClass).toContain('anomaly');
    await expect(page.locator('#noticeText')).toContainText('異変');
  });

  test('隅待ちを続けると鬼がクセを読み、プレイヤーへ通知される', async ({ page }) => {
    await waitForApp(page);
    await page.click('#btnStart');
    await page.waitForFunction(() => window.__ningenkagu.game.state === 'playing');
    await page.evaluate(() => window.__ningenkagu.hud.hideNotice());

    await page.evaluate(() => {
      const game = window.__ningenkagu.game;
      game.player.position.x = -7.25;
      game.player.position.z = 0;
      game.habitModel.update(21, game);
    });

    await page.waitForFunction(() => window.__ningenkagu.habitInfo().learned === 'corner');
    await expect(page.locator('#noticeText')).toContainText('鬼がクセを読んだ');
    await expect(page.locator('#noticeText')).toContainText('隅待ち');
  });

  test('異変とステージイベントは同時発生しない', async ({ page }) => {
    await waitForApp(page);
    await page.click('#btnStart');
    await page.waitForFunction(() => window.__ningenkagu.game.state === 'playing');

    expect(await page.evaluate(() => window.__ningenkagu.triggerAnomaly())).toBe(true);
    expect(await page.evaluate(() => window.__ningenkagu.triggerStageEvent())).toBe(false);
  });
});
