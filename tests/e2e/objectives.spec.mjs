import { test, expect } from '@playwright/test';

async function start(page, challenge) {
  await page.addInitScript(() => {
    localStorage.setItem('ningenkagu.completed', '1');
    localStorage.setItem('ningenkagu.openingSeen.v1', '1');
  });
  await page.goto('/index.html');
  await page.waitForFunction(() => !!window.__ningenkagu);
  if (challenge) {
    await page.click('#btnChallenge');
    await page.click(`[data-challenge="${challenge}"]`);
  }
  await page.click('#btnStart');
  await page.waitForFunction(() => window.__ningenkagu.game.state === 'playing');
}

test('mobile objective fits, survives pause and resets on retry', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await start(page);
  const objective = page.locator('#objective');
  await expect(objective).toBeVisible();
  await expect(objective).toContainText('冷静沈着');
  const box = await objective.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(375);
  await page.evaluate(() => { window.__ningenkagu.game.stats.maxSuspicion = .63; });
  await expect(objective).toHaveAttribute('data-state', 'failed');
  await page.evaluate(() => window.__ningenkagu.game.pause());
  await page.evaluate(() => window.__ningenkagu.game.resume());
  await expect(objective).toHaveAttribute('data-state', 'failed');
  await page.evaluate(() => window.__ningenkagu.game.lose());
  await page.click('#btnRetry');
  await expect(objective).toHaveAttribute('data-state', 'active');
  await expect(objective).not.toContainText('条件失敗');
});

test('challenge readiness remains after suspicion falls', async ({ page }) => {
  await start(page, 'dangerDance');
  await expect(page.locator('#objective')).toContainText('危険地帯');
  await page.evaluate(() => {
    const g = window.__ningenkagu.game;
    g.stats.maxSuspicion = .76;
    g.suspicion = 0;
  });
  await expect(page.locator('#objective')).toHaveAttribute('data-state', 'ready');
  await expect(page.locator('#objective')).toContainText('警戒を下げて');
});

test('batched pose presses cannot skip the no-crouch failure', async ({ page }) => {
  await start(page, 'noCrouch');
  const result = await page.evaluate(() => {
    const g = window.__ningenkagu.game;
    const input = {
      updateGamepad() {}, consumePause: () => false,
      consumeLook: () => ({ dx: 0, dy: 0 }), consumePose: () => 4,
      consumeMimic: () => false, consumeDecoy: () => false,
      move: { x: 0, y: 0 },
    };
    g.update(.016, input);
    return { pose: g.player.pose, failed: g.challengeFailed };
  });
  expect(result).toEqual({ pose: 'stand', failed: true });
  await expect(page.locator('#objective')).toHaveAttribute('data-state', 'failed');
});
