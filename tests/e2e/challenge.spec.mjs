import { test, expect } from '@playwright/test';

async function waitForApp(page) {
  await page.goto('/index.html');
  await page.waitForFunction(() => !!window.__ningenkagu, null, { timeout: 15_000 });
}

async function unlockChallenges(page, stageIndex = 0) {
  await page.addInitScript(({ stageIndex }) => {
    localStorage.setItem('ningenkagu.completed', '1');
    localStorage.setItem('ningenkagu.stageIndex', String(stageIndex));
  }, { stageIndex });
  await waitForApp(page);
}

test.describe('チャレンジモード', () => {
  test('クラシッククリア前は封印され、達成後に選択できる', async ({ page }) => {
    await waitForApp(page);
    await expect(page.locator('#btnChallenge')).toBeDisabled();
    await expect(page.locator('#btnChallenge')).toContainText('🔒 チャレンジ');

    await page.evaluate(() => localStorage.setItem('ningenkagu.completed', '1'));
    await page.reload();
    await page.waitForFunction(() => !!window.__ningenkagu, null, { timeout: 15_000 });

    await expect(page.locator('#btnChallenge')).toBeEnabled();
    await page.click('#btnChallenge');
    await expect(page.locator('#cardChallenge')).toBeVisible();
    await page.click('[data-challenge="noDecoy"]');
    await expect(page.locator('#btnStart')).toContainText('おとり禁止開始');
  });

  test('おとり禁止は0回で開始し、クリア記録を保存する', async ({ page }) => {
    await unlockChallenges(page);
    await page.click('#btnChallenge');
    await page.click('[data-challenge="noDecoy"]');
    await page.click('#btnStart');
    await page.waitForFunction(() => window.__ningenkagu.game.state === 'playing');

    expect(await page.evaluate(() => ({
      challenge: window.__ningenkagu.game.challengeId,
      decoys: window.__ningenkagu.game.decoyUses,
    }))).toEqual({ challenge: 'noDecoy', decoys: 0 });

    await page.evaluate(() => window.__ningenkagu.game.win());
    await expect(page.locator('#resultTitle')).toHaveText('CHALLENGE CLEAR!');
    expect(await page.evaluate(() => localStorage.getItem('ningenkagu.challengeClear.noDecoy'))).toBe('1');
  });

  test('チャレンジ中の理科室クリアはCLASSIC CLEAR表示で上書きされない', async ({ page }) => {
    await unlockChallenges(page, 4);
    await page.click('#btnChallenge');
    await page.click('[data-challenge="noDecoy"]');
    await page.click('#btnStart');
    await page.waitForFunction(() => window.__ningenkagu.game.stage.id === 'scienceroom');

    await page.evaluate(() => window.__ningenkagu.game.win());
    await expect(page.locator('#resultTitle')).toHaveText('CHALLENGE CLEAR!');
    await expect(page.locator('#resultNote')).toContainText('おとり禁止');
  });

  test('5条件の最後を埋めるとCHALLENGE MASTERになる', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('ningenkagu.completed', '1');
      for (const id of ['oneMimic', 'noCrouch', 'anomalyRush', 'dangerDance']) {
        localStorage.setItem('ningenkagu.challengeClear.' + id, '1');
      }
    });
    await waitForApp(page);

    await page.click('#btnChallenge');
    await page.click('[data-challenge="noDecoy"]');
    await page.click('#btnStart');
    await page.waitForFunction(() => window.__ningenkagu.game.state === 'playing');
    await page.evaluate(() => window.__ningenkagu.game.win());

    await expect(page.locator('#resultTitle')).toHaveText('CHALLENGE MASTER!');
    await expect(page.locator('#resultNote')).toContainText('CHALLENGE MASTER');

    await page.click('#btnResultTitle');
    await page.click('#btnChallenge');
    await expect(page.locator('#challengeProgress')).toHaveText('チャレンジ 5/5');
    await expect(page.locator('#challengeMasterBadge')).toBeVisible();
  });
});
