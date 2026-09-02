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

    // 上側の空いた通路を実際の入力経路で走り、ゲーム本体が移動距離を記録することを確認する。
    await page.evaluate(() => {
      const { game } = window.__ningenkagu;
      game.player.position.set(-4.5, 0, 5.0);
      game.camYaw = 0;
      game.oni.senseTarget = () => ({ visible: false, dist: 99, centrality: 0, fraction: 0, peripheral: false });
    });
    await page.waitForTimeout(100);
    await page.evaluate(() => {
      window.__ningenkagu.input.stick.x = 1;
    });
    await page.waitForFunction(
      () => (window.__ningenkaguMissions.tracker()?.steamDistance || 0) >= 7,
      null,
      // SwiftShader環境ではゲーム内時間が実時間より遅く進むことがある。
      { timeout: 15_000 },
    );
    await page.evaluate(() => { window.__ningenkagu.input.stick.x = 0; });

    const distance = await page.evaluate(() => window.__ningenkaguMissions.tracker()?.steamDistance || 0);
    expect(distance).toBeGreaterThanOrEqual(7);

    await page.evaluate(() => window.__ningenkagu.game.win());
    await expect(page.locator('#resultMission')).toHaveText('✓ 白煙突破');
  });

  test('理科室クリアでALL CLEARになり、制覇記録がタイトルにも残る', async ({ page }) => {
    await unlockScience(page);
    await page.click('#btnStart');
    await page.waitForFunction(() => window.__ningenkagu.game.state === 'playing');

    await page.evaluate(() => window.__ningenkagu.game.win());

    await expect(page.locator('#resultTitle')).toHaveText('ALL CLEAR!');
    await expect(page.locator('#resultNote')).toContainText('全5ステージ制覇');
    await expect(page.locator('#btnRetry')).toHaveText('理科室をもう一度');
    expect(await page.evaluate(() => localStorage.getItem('ningenkagu.completed'))).toBe('1');

    await page.click('#btnResultTitle');
    await expect(page.locator('#allClearBadge')).toContainText('全5ステージ制覇済み');
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

  test('クリア後にタイトルへ戻っても次のステージが解放済みになる', async ({ page }) => {
    await page.goto('/index.html');
    await page.waitForFunction(() => !!window.__ningenkagu, null, { timeout: 15_000 });

    await page.click('#btnStart');
    await page.evaluate(() => window.__ningenkagu.game.win());
    await page.click('#btnResultTitle');

    await expect(page.locator('[data-stage="1"]')).toBeEnabled();
    await expect(page.locator('[data-stage="1"]')).not.toContainText('🔒');
    expect(await page.evaluate(() => localStorage.getItem('ningenkagu.stageIndex'))).toBe('1');
  });
});
