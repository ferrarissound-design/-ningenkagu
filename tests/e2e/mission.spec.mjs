import { test, expect } from '@playwright/test';

async function waitForApp(page) {
  await page.goto('/index.html');
  await page.waitForFunction(() => !!window.__ningenkagu && !!window.__ningenkaguMissions, null, { timeout: 15_000 });
}

test.describe('ステージ別ミッション', () => {
  test('タイトルに選択中ステージのミッションが表示される', async ({ page }) => {
    await waitForApp(page);
    await expect(page.locator('#selStageMission')).toContainText('冷静沈着');
    await expect(page.locator('#selStageMission')).toContainText('警戒度62%未満');
  });

  test('リビングのミッション達成を保存し、タイトルへ戻ると★が付く', async ({ page }) => {
    await waitForApp(page);
    await page.click('#btnStart');
    await page.waitForFunction(() => !!window.__ningenkaguMissions.tracker());

    await page.evaluate(() => {
      window.__ningenkagu.game.suspicion = 0.1;
      window.__ningenkagu.game.win();
    });

    await expect(page.locator('#resultMission')).toHaveText('✓ 冷静沈着');
    expect(await page.evaluate(() => localStorage.getItem('ningenkagu.mission.living'))).toBe('1');

    await page.click('#btnResultTitle');
    await expect(page.locator('#selStageMission')).toContainText('達成済み');
    await expect(page.locator('[data-stage="0"]')).toContainText('★');
  });

  test('図書室で足音警戒を起こすと完全静音は未達成', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('ningenkagu.stageIndex', '3'));
    await waitForApp(page);
    await page.click('#btnStart');
    await page.waitForFunction(() => !!window.__ningenkaguMissions.tracker());

    await page.evaluate(() => { window.__ningenkagu.game.noiseWarned = true; });
    await page.waitForFunction(() => window.__ningenkaguMissions.tracker()?.heardAlert === true);
    await page.evaluate(() => window.__ningenkagu.game.win());

    await expect(page.locator('#resultMission')).toHaveText('× 完全静音');
    expect(await page.evaluate(() => localStorage.getItem('ningenkagu.mission.library'))).toBeNull();
  });
});
