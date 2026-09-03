import { test, expect } from '@playwright/test';

async function waitForApp(page) {
  await page.goto('/index.html');
  await page.waitForFunction(() => !!window.__ningenkagu, null, { timeout: 15_000 });
}

test.describe('特訓モードと公平な鬼抽選', () => {
  test('ALL CLEAR前は特訓を封印表示し、達成後は鬼を指名して開始できる', async ({ page }) => {
    await waitForApp(page);
    const training = page.locator('#btnTraining');
    await expect(training).toBeVisible();
    await expect(training).toBeDisabled();
    await expect(training).toContainText('🔒 特訓モード');
    await expect(training).toHaveAttribute('aria-disabled', 'true');

    await page.evaluate(() => localStorage.setItem('ningenkagu.completed', '1'));
    await page.reload();
    await page.waitForFunction(() => !!window.__ningenkagu, null, { timeout: 15_000 });
    await expect(training).toBeVisible();
    await expect(training).toBeEnabled();
    await expect(training).toHaveAttribute('aria-disabled', 'false');

    await page.click('#btnTraining');
    await expect(page.locator('#cardTraining')).toBeVisible();
    await page.click('[data-oni-training="suspicious"]');
    await expect(page.locator('#btnStart')).toContainText('疑り深い鬼と特訓開始');
    await page.click('#btnStart');
    await page.waitForFunction(() => window.__ningenkagu.game.state === 'playing');
    expect(await page.evaluate(() => window.__ningenkagu.game.oni.personality.id)).toBe('suspicious');
  });

  test('通常モードは3戦で3タイプすべてと戦える', async ({ page }) => {
    await waitForApp(page);
    const opponents = [];

    for (let i = 0; i < 3; i++) {
      await page.click('#btnStart');
      await page.waitForFunction(() => window.__ningenkagu.game.state === 'playing');
      opponents.push(await page.evaluate(() => window.__ningenkagu.game.oni.personality.id));
      await page.evaluate(() => window.__ningenkagu.game.pause());
      await page.click('#btnPauseTitle');
      await expect(page.locator('#title')).toBeVisible();
    }

    expect(new Set(opponents).size).toBe(3);
  });

  test('壊れた設定値は操作可能な範囲へ自動補正される', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('ningenkagu.bgmVolume', '9999');
      localStorage.setItem('ningenkagu.sfxVolume', '-30');
      localStorage.setItem('ningenkagu.lookSensitivity', 'broken');
    });
    await waitForApp(page);

    const values = await page.evaluate(() => ({
      bgm: document.getElementById('rangeBgmVolume').value,
      sfx: document.getElementById('rangeSfxVolume').value,
      sensitivity: document.getElementById('rangeSensitivity').value,
      appliedSensitivity: window.__ningenkagu.input.lookSensitivity,
    }));
    expect(values).toEqual({ bgm: '100', sfx: '0', sensitivity: '100', appliedSensitivity: 1 });
  });
});
