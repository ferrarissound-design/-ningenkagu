import { test, expect } from '@playwright/test';

async function waitForApp(page) {
  await page.goto('/index.html');
  await page.waitForFunction(() => !!window.__ningenkagu, null, { timeout: 15_000 });
}

test.describe('家具図鑑', () => {
  test('タイトルから開閉でき、未発見状態を表示する', async ({ page }) => {
    await waitForApp(page);

    await expect(page.locator('#btnCatalog')).toContainText('家具図鑑 0/10');
    await page.click('#btnCatalog');
    await expect(page.locator('#catalogOverlay')).toBeVisible();
    await expect(page.locator('#catalogProgressText, .catalogProgressText')).toContainText('0/10');
    await expect(page.locator('html')).toHaveClass(/title-card-open/);

    await page.click('.catalogClose');
    await expect(page.locator('#catalogOverlay')).toBeHidden();
    await expect(page.locator('html')).not.toHaveClass(/title-card-open/);
  });

  test('保存済みの発見状況をタイトルと図鑑へ復元する', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('ningenkagu.catalog', JSON.stringify(['chair', 'table']));
    });
    await waitForApp(page);

    await expect(page.locator('#btnCatalog')).toContainText('家具図鑑 2/10');
    await expect(page.locator('#catalogStat')).toHaveText('2/10');
    await page.click('#btnCatalog');
    await expect(page.locator('.catalogEntry:not(.locked)')).toHaveCount(2);
    await expect(page.locator('.catalogEntry:not(.locked) h3')).toContainText(['テーブル・机', 'イス']);
  });

  test('ゲーム中の初回擬態で家具タイプを登録する', async ({ page }) => {
    await waitForApp(page);
    await page.click('#btnStart');
    await page.waitForFunction(() => window.__ningenkagu.game.state === 'playing');

    const discovery = await page.evaluate(() => {
      const game = window.__ningenkagu.game;
      const target = game.stage.targets.find((item) => item?.kind) || null;
      if (!target) return null;
      game.nearTarget = target;
      game.tryMimic();
      return {
        kind: target.kind,
        saved: JSON.parse(localStorage.getItem('ningenkagu.catalog') || '[]'),
      };
    });

    expect(discovery).not.toBeNull();
    expect(discovery.saved).toContain(discovery.kind);
    await expect(page.locator('#popups')).toContainText(/NEW!|家具図鑑 COMPLETE/);
  });
});
