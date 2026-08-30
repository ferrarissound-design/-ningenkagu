import { test, expect } from '@playwright/test';

async function unlockLibrary(page) {
  await page.addInitScript(() => {
    localStorage.setItem('ningenkagu.stageIndex', '3');
  });
  await page.goto('/index.html');
  await page.waitForFunction(() => !!window.__ningenkagu, null, { timeout: 15_000 });
}

test.describe('STAGE 4 図書室', () => {
  test('タイトルから選択でき、図書室としてゲーム開始できる', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));

    await unlockLibrary(page);

    const stage4 = page.locator('[data-stage="3"]');
    await expect(stage4).toBeEnabled();
    await expect(stage4).toContainText('図書室');
    await expect(page.locator('#selStageName')).toHaveText('図書室');

    expect(await page.evaluate(() => window.__ningenkagu.stages.map((s) => s.id)))
      .toEqual(['living', 'classroom', 'artroom', 'library']);

    await page.click('#btnStart');
    await page.waitForFunction(() => window.__ningenkagu.game.state === 'playing');

    const stage = await page.evaluate(() => ({
      id: window.__ningenkagu.game.stage.id,
      name: window.__ningenkagu.game.stage.name,
      targets: window.__ningenkagu.game.stage.targets.length,
    }));
    expect(stage.id).toBe('library');
    expect(stage.name).toBe('図書室');
    expect(stage.targets).toBeGreaterThanOrEqual(19);
    expect(errors).toEqual([]);
  });

  test('「本が崩れた！」イベントを強制発生できる', async ({ page }) => {
    await unlockLibrary(page);
    await page.click('#btnStart');
    await page.waitForFunction(() => window.__ningenkagu.game.state === 'playing');

    const started = await page.evaluate(() => window.__ningenkagu.triggerStageEvent());
    expect(started).toBe(true);

    const info = await page.evaluate(() => window.__ningenkagu.stageEventInfo());
    expect(info.stage).toBe('library');
    expect(info.event).toBe('bookfall');
    expect(['active', 'warning']).toContain(info.phase);
    await expect(page.locator('#noticeText')).toContainText('本が崩れた');
  });
});
