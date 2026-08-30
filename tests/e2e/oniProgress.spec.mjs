import { test, expect } from '@playwright/test';

async function waitForApp(page) {
  await page.goto('/index.html');
  await page.waitForFunction(
    () => !!window.__ningenkagu && !!window.__ningenkaguMissions?.oniProgress,
    null,
    { timeout: 15_000 },
  );
}

test.describe('鬼タイプ別クリア記録', () => {
  test('勝利したステージ×鬼タイプを保存し、タイトル進捗へ反映する', async ({ page }) => {
    await waitForApp(page);
    await expect(page.locator('#selOniProgress')).toContainText('鬼攻略 0/15');

    await page.click('#btnStart');
    await page.waitForFunction(() => !!window.__ningenkaguMissions.tracker());

    await page.evaluate(() => {
      const game = window.__ningenkagu.game;
      game.oni.applyPersonality('watcher');
      game.win();
    });

    await expect(page.locator('#resultOniClear')).toHaveText('✓ 👁 見張り鬼');
    expect(await page.evaluate(() => localStorage.getItem('ningenkagu.oniClear.living.watcher'))).toBe('1');

    await page.click('#btnResultTitle');
    await expect(page.locator('#selOniProgress')).toContainText('鬼攻略 1/15');
    await expect(page.locator('#selOniProgress')).toContainText('👁✓');

    const progress = await page.evaluate(() => window.__ningenkaguMissions.oniProgress.count());
    expect(progress).toEqual({ cleared: 1, total: 15, complete: false });
  });

  test('15組すべて攻略すると完全制覇を表示する', async ({ page }) => {
    await page.addInitScript(() => {
      const stages = ['living', 'classroom', 'artroom', 'library', 'scienceroom'];
      const onis = ['watcher', 'charger', 'suspicious'];
      for (const stage of stages) {
        for (const oni of onis) localStorage.setItem(`ningenkagu.oniClear.${stage}.${oni}`, '1');
      }
      localStorage.setItem('ningenkagu.stageIndex', '4');
    });

    await waitForApp(page);
    await expect(page.locator('#selOniProgress')).toContainText('鬼攻略 15/15');
    await expect(page.locator('#selOniProgress')).toContainText('👑 完全制覇');
    await expect(page.locator('#selOniProgress')).toContainText('👁✓ 💨✓ 🧐✓');
  });

  test('敗北では鬼攻略記録を保存しない', async ({ page }) => {
    await waitForApp(page);
    await page.click('#btnStart');
    await page.waitForFunction(() => !!window.__ningenkaguMissions.tracker());

    await page.evaluate(() => {
      const game = window.__ningenkagu.game;
      game.oni.applyPersonality('suspicious');
      game.lose();
    });

    await expect(page.locator('#resultOniClear')).toHaveText('× 🧐 疑り深い鬼');
    expect(await page.evaluate(() => localStorage.getItem('ningenkagu.oniClear.living.suspicious'))).toBeNull();
  });
});
