import { test, expect } from '@playwright/test';

async function unlockScience(page) {
  await page.addInitScript(() => {
    localStorage.setItem('ningenkagu.stageIndex', '4');
  });
  await page.goto('/index.html');
  await page.waitForFunction(
    () => !!window.__ningenkagu && !!window.__ningenkaguMissions,
    null,
    { timeout: 15_000 },
  );
}

test.describe('STAGE 5 理科室', () => {
  test('保存済み進行から理科室を選択状態で起動できる', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await unlockScience(page);

    const stage5 = page.locator('[data-stage="4"]');
    await expect(stage5).toBeVisible();
    await expect(stage5).toBeEnabled();
    await expect(stage5).toContainText('理科室');
    await expect(page.locator('#selStageName')).toHaveText('理科室');
    await expect(page.locator('#selStageMission')).toContainText('白煙突破');
    await expect(page.locator('#selOniProgress')).toContainText('鬼攻略 0/15');

    await page.click('#btnStart');
    await page.waitForFunction(() => window.__ningenkagu.game.state === 'playing');

    const stage = await page.evaluate(() => ({
      id: window.__ningenkagu.game.stage.id,
      name: window.__ningenkagu.game.stage.name,
      targets: window.__ningenkagu.game.stage.targets.length,
    }));
    expect(stage.id).toBe('scienceroom');
    expect(stage.name).toBe('理科室');
    expect(stage.targets).toBeGreaterThanOrEqual(18);
    expect(errors).toEqual([]);
  });

  test('蒸気イベントで鬼の視界が落ち、理科室ミッションの移動距離を記録する', async ({ page }) => {
    await unlockScience(page);
    await page.click('#btnStart');
    await page.waitForFunction(() => !!window.__ningenkaguMissions.tracker());

    const beforeRange = await page.evaluate(() => window.__ningenkagu.game.oni.view.range);
    await page.evaluate(() => window.__ningenkagu.hud.hideNotice());
    const started = await page.evaluate(() => window.__ningenkagu.triggerStageEvent());
    expect(started).toBe(true);

    const eventState = await page.evaluate(() => ({
      info: window.__ningenkagu.stageEventInfo(),
      range: window.__ningenkagu.game.oni.view.range,
    }));
    expect(eventState.info.stage).toBe('scienceroom');
    expect(eventState.info.event).toBe('steam');
    expect(eventState.range).toBeLessThan(beforeRange);
    await expect(page.locator('#noticeText')).toContainText('蒸気が噴き出した');

    // 部屋外へ押し出される座標を使わず、上側の空いた通路上を2回移動する。
    // これなら衝突補正が入ってもイベント中の実移動距離を安定して7m以上記録できる。
    await page.evaluate(() => {
      window.__ningenkagu.game.player.position.set(0, 0, 5.0);
    });
    await page.waitForTimeout(100);
    await page.evaluate(() => {
      window.__ningenkagu.game.player.position.set(5.2, 0, 5.0);
    });
    await page.waitForTimeout(100);

    const distance = await page.evaluate(() => window.__ningenkaguMissions.tracker()?.steamDistance || 0);
    expect(distance).toBeGreaterThanOrEqual(7);

    await page.evaluate(() => window.__ningenkagu.game.win());
    await expect(page.locator('#resultMission')).toHaveText('✓ 白煙突破');
  });

  test('図書室クリア後の「次のステージへ」で理科室へ進む', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('ningenkagu.stageIndex', '3'));
    await page.goto('/index.html');
    await page.waitForFunction(() => !!window.__ningenkagu, null, { timeout: 15_000 });
    await expect(page.locator('#selStageName')).toHaveText('図書室');

    await page.click('#btnStart');
    await page.evaluate(() => window.__ningenkagu.game.win());
    await expect(page.locator('#btnRetry')).toHaveText('次のステージへ');
    await expect(page.locator('#resultNote')).toContainText('理科室');

    await page.click('#btnRetry');
    await page.waitForFunction(() => window.__ningenkagu.game.stage.id === 'scienceroom');
    expect(await page.evaluate(() => localStorage.getItem('ningenkagu.stageIndex'))).toBe('4');
  });
});
