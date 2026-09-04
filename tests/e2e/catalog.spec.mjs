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

  test('図鑑を開いた状態で他のタイトルカードが開かれると図鑑側が閉じる', async ({ page }) => {
    // 図鑑オーバーレイは #btnHow などを視覚的に覆っており、通常のポインタ操作では
    // 到達できない（closeOtherTitleCards の逆方向がなくても実害が出にくい理由）。
    // ここではスクリーンリーダーの仮想カーソルなど、視覚レイヤーを介さずに
    // 他ボタンが直接 .click() されるケース（force clickも実座標では図鑑に
    // 吸われてしまうため、要素の .click() を直接呼んで再現する）を検証する。
    await waitForApp(page);

    await page.click('#btnCatalog');
    await expect(page.locator('#catalogOverlay')).toBeVisible();

    await page.evaluate(() => document.getElementById('btnHow').click());
    await expect(page.locator('#catalogOverlay')).toBeHidden();
    await expect(page.locator('#btnCatalog')).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('#cardHow')).toBeVisible();
    await expect(page.locator('html')).toHaveClass(/title-card-open/);
  });

  test('保存に失敗する環境でも初回発見のNEW!表示は連打されない', async ({ page }) => {
    await page.addInitScript(() => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function patchedSetItem(key, value) {
        if (key === 'ningenkagu.catalog') {
          throw new DOMException('QuotaExceededError', 'QuotaExceededError');
        }
        return original.call(this, key, value);
      };
    });
    await waitForApp(page);
    await page.click('#btnStart');
    await page.waitForFunction(() => window.__ningenkagu.game.state === 'playing');

    const result = await page.evaluate(() => {
      const game = window.__ningenkagu.game;
      const target = game.stage.targets.find((item) => item?.kind) || null;
      if (!target) return null;
      const newlyDiscoveredCount = [0, 1, 2].map(() => {
        game.nearTarget = target;
        const before = document.querySelectorAll('#popups .popup').length;
        game.tryMimic();
        const texts = [...document.querySelectorAll('#popups .popup')]
          .slice(before)
          .map((el) => el.textContent);
        return texts.some((text) => text.includes('NEW!') || text.includes('COMPLETE'));
      });
      return newlyDiscoveredCount;
    });

    expect(result).toEqual([true, false, false]);
  });
});
