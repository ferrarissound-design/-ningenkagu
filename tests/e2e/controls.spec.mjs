import { test, expect } from '@playwright/test';

async function waitForApp(page) {
  await page.goto('/index.html');
  await page.waitForFunction(() => !!window.__ningenkagu && !!window.__ningenkaguMissions, null, { timeout: 15_000 });
}

test.describe('画面上の操作ボタン', () => {
  test('「おとり」ボタンが実際におとりを発動する（スマホで唯一の入力経路）', async ({ page }) => {
    await waitForApp(page);
    await page.click('#btnStart');
    await page.waitForFunction(() => window.__ningenkagu.game.state === 'playing');

    const before = await page.evaluate(() => window.__ningenkagu.game.decoyUses);
    expect(before).toBe(2);
    await expect(page.locator('#decoyHint')).toHaveText('R ×2');

    await page.click('#btnDecoy');
    await page.waitForFunction(() => window.__ningenkagu.game.decoyUses === 1, null, { timeout: 5_000 });
    await expect(page.locator('#decoyHint')).toHaveText('R ×1');
  });

  test('擬態・ポーズボタンも同じ経路で効く', async ({ page }) => {
    await waitForApp(page);
    await page.click('#btnStart');
    await page.waitForFunction(() => window.__ningenkagu.game.state === 'playing');

    await page.click('#btnPose');
    await page.waitForFunction(() => window.__ningenkagu.game.player.pose !== 'stand', null, { timeout: 5_000 });
  });
});

test.describe('一時停止とミッション統計', () => {
  test('ポーズして再開してもミッションの積み上げが消えない', async ({ page }) => {
    await waitForApp(page);
    await page.click('#btnStart');
    await page.waitForFunction(() => !!window.__ningenkaguMissions.tracker());

    // 実プレイと同じ経路で「擬態した家具の種類」を積む。
    // トラッカーは毎フレーム1つずつ拾うので、1種類ごとに反映を待つ。
    const kinds = await page.evaluate(() => {
      const seen = [];
      for (const t of window.__ningenkagu.game.stage.targets) {
        if (!seen.includes(t.kind)) seen.push(t.kind);
        if (seen.length >= 3) break;
      }
      return seen;
    });
    expect(kinds.length).toBe(3);
    for (const kind of kinds) {
      await page.evaluate((k) => {
        const g = window.__ningenkagu.game;
        g.player.mimic(g.stage.targets.find((t) => t.kind === k));
      }, kind);
      await page.waitForFunction(
        (k) => window.__ningenkaguMissions.tracker()?.mimicKinds.includes(k),
        kind
      );
    }

    await page.evaluate(() => window.__ningenkagu.game.pause());
    await page.waitForFunction(() => window.__ningenkagu.game.state === 'paused');
    await page.click('#btnResume');
    await page.waitForFunction(() => window.__ningenkagu.game.state === 'playing');

    // 再開後もう数フレーム回したうえで、統計が残っていることを確かめる
    await page.waitForTimeout(200);
    const kept = await page.evaluate(() => window.__ningenkaguMissions.tracker()?.mimicKinds.length ?? 0);
    expect(kept).toBeGreaterThanOrEqual(3);
  });
});
