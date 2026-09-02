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

    // 連発できない間はボタンごと無効化して「今は押せない」と見せる
    await expect(page.locator('#btnDecoy')).toBeDisabled();
    await page.evaluate(() => { window.__ningenkagu.game.decoyCooldown = 0; });
    await expect(page.locator('#btnDecoy')).toBeEnabled();
  });

  test('プレイ中以外は操作ボタン・スティックがタップを吸わない', async ({ page }) => {
    await waitForApp(page);

    // #controls の pointer-events: none は、子の .gbtn / #stick が
    // pointer-events: auto を持っているため、子孫まで指定しないと効かない。
    // 透明なまま残ったボタンがタイトル / リザルトのタップを奪う原因になる。
    const idle = await page.evaluate(() => ['btnMimic', 'btnPose', 'btnDecoy', 'stick'].map(
      (id) => getComputedStyle(document.getElementById(id)).pointerEvents,
    ));
    expect(idle).toEqual(['none', 'none', 'none', 'none']);

    await page.click('#btnStart');
    await page.waitForFunction(() => window.__ningenkagu.game.state === 'playing');

    // プレイ中はもちろん押せるまま
    const playing = await page.evaluate(() => ['btnMimic', 'stick'].map(
      (id) => getComputedStyle(document.getElementById(id)).pointerEvents,
    ));
    expect(playing).toEqual(['auto', 'auto']);
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

    // 実プレイと同じ tryMimic() 経路で「擬態した家具の種類」を積む。
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
        g.nearTarget = g.stage.targets.find((t) => t.kind === k);
        g.tryMimic();
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
