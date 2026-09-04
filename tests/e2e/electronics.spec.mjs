import { test, expect } from '@playwright/test';

async function unlockElectronics(page) {
  await page.addInitScript(() => {
    localStorage.setItem('ningenkagu.completed', '1');
    localStorage.setItem('ningenkagu.stageIndex', '5');
  });
  await page.goto('/index.html');
  await page.waitForFunction(
    () => !!window.__ningenkagu && !!window.__ningenkaguMissions,
    null,
    { timeout: 15_000 },
  );
}

test.describe('STAGE 6 深夜の家電量販店', () => {
  test('旧5面クリア済みならSTAGE 6は解放されるが選択は勝手に変わらない', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('ningenkagu.completed', '1');
      localStorage.setItem('ningenkagu.stageIndex', '4');
    });
    await page.goto('/index.html');
    await page.waitForFunction(() => !!window.__ningenkagu, null, { timeout: 15_000 });

    await expect(page.locator('#selStageName')).toHaveText('理科室');
    await expect(page.locator('[data-stage="5"]')).toBeEnabled();
    await expect(page.locator('[data-stage="5"]')).toContainText('家電量販店');
  });

  test('テレビ・冷蔵庫・洗濯機・マッサージチェアへ擬態できる売場として起動する', async ({ page }) => {
    await unlockElectronics(page);
    await expect(page.locator('#selStageName')).toHaveText('家電量販店');
    await expect(page.locator('#selStageMission')).toContainText('デモ横断');

    await page.click('#btnStart');
    await page.waitForFunction(() => window.__ningenkagu.game.state === 'playing');

    const stage = await page.evaluate(() => {
      const game = window.__ningenkagu.game;
      return {
        id: game.stage.id,
        name: game.stage.name,
        kinds: [...new Set(game.stage.targets.map((t) => t.kind))],
        targets: game.stage.targets.length,
      };
    });
    expect(stage.id).toBe('electronics');
    expect(stage.name).toBe('家電量販店');
    expect(stage.targets).toBeGreaterThanOrEqual(20);
    for (const kind of ['tv', 'fridge', 'washer', 'massage']) expect(stage.kinds).toContain(kind);
  });

  test('展示デモ一斉再生イベントを強制発生できる', async ({ page }) => {
    await unlockElectronics(page);
    await page.click('#btnStart');
    await page.waitForFunction(() => window.__ningenkagu.game.state === 'playing');
    await page.evaluate(() => window.__ningenkagu.hud.hideNotice());

    const started = await page.evaluate(() => window.__ningenkagu.triggerStageEvent());
    expect(started).toBe(true);
    await expect(page.locator('#noticeText')).toContainText('展示デモ一斉再生');

    const info = await page.evaluate(() => window.__ningenkagu.stageEventInfo());
    expect(info.stage).toBe('electronics');
    expect(info.event).toBe('demo');
  });

  test('展示デモ中に決着してもリトライ時には展示テレビが消えている', async ({ page }) => {
    await unlockElectronics(page);
    await page.click('#btnStart');
    await page.waitForFunction(() => window.__ningenkagu.game.state === 'playing');

    const readScreens = () => window.__ningenkagu.game.stage.eventRig.screens.map((screen) => ({
      emissive: screen.material.emissive.getHex(),
      intensity: screen.material.emissiveIntensity,
    }));

    const dark = await page.evaluate(readScreens);
    expect(await page.evaluate(() => window.__ningenkagu.triggerStageEvent())).toBe(true);
    const lit = await page.evaluate(readScreens);
    expect(lit).not.toEqual(dark);

    // デモ再生中に発見される＝ onEnd を通らずに stageEvent.abort() される
    await page.evaluate(() => window.__ningenkagu.game.lose());
    expect(await page.evaluate(readScreens)).toEqual(dark);

    // 同じステージ実体を使い回すリトライでも、光ったまま持ち越さない
    await page.click('#btnRetry');
    await page.waitForFunction(() => window.__ningenkagu.game.state === 'playing');
    expect(await page.evaluate(readScreens)).toEqual(dark);
  });

  test('家電量販店クリアで全6ステージALL CLEARになる', async ({ page }) => {
    await unlockElectronics(page);
    await page.click('#btnStart');
    await page.waitForFunction(() => window.__ningenkagu.game.state === 'playing');

    await page.evaluate(() => window.__ningenkagu.game.win());
    await expect(page.locator('#resultTitle')).toHaveText('ALL CLEAR!');
    expect(await page.evaluate(() => localStorage.getItem('ningenkagu.completed'))).toBe('1');
    expect(await page.evaluate(() => localStorage.getItem('ningenkagu.completed6'))).toBe('1');

    await page.click('#btnResultTitle');
    await expect(page.locator('#allClearBadge')).toContainText('全6ステージ制覇済み');
  });
});
