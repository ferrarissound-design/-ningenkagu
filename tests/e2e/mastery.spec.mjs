import { test, expect } from '@playwright/test';

async function waitForApp(page) {
  await page.goto('/index.html');
  await page.waitForFunction(() => !!window.__ningenkagu && !!window.__ningenkaguMastery, null, { timeout: 15_000 });
}

const STAGES = ['living', 'classroom', 'artroom', 'library', 'scienceroom'];
const ONIS = ['watcher', 'charger', 'suspicious'];

test.describe('やりこみ MASTER CLEAR', () => {
  test('初期状態は0/26で、まず全ステージ制覇を案内する', async ({ page }) => {
    await waitForApp(page);

    await expect(page.locator('#masteryPanel')).toBeVisible();
    await expect(page.locator('#masteryTitle')).toContainText('0/26');
    await expect(page.locator('#masteryNext')).toContainText('全5ステージ制覇');
    await expect(page.locator('#masteryCompact')).toContainText('0/26');

    const bar = page.locator('#masteryBar');
    await expect(bar).toHaveAttribute('max', '26');
    await expect(bar).toHaveAttribute('value', '0');
  });

  test('スマホ幅でもタイトル下部にやりこみ進行が見える', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await waitForApp(page);

    // 右の情報カードは860px以下で畳まれるため、短縮表示がスマホでの主表示になる。
    await expect(page.locator('#masteryPanel')).toBeHidden();
    await expect(page.locator('#masteryCompact')).toBeVisible();
    await expect(page.locator('#masteryCompact')).toContainText('0/26');
  });

  test('高さが低い横長画面でも情報カードが画面外へ逃げずスクロールできる', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 420 });
    await waitForApp(page);

    const geometry = await page.locator('#cardInfo').evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return {
        top: rect.top,
        bottom: rect.bottom,
        innerHeight: window.innerHeight,
        clientHeight: el.clientHeight,
        scrollHeight: el.scrollHeight,
        overflowY: getComputedStyle(el).overflowY,
      };
    });

    expect(geometry.top).toBeGreaterThanOrEqual(0);
    expect(geometry.bottom).toBeLessThanOrEqual(geometry.innerHeight + 1);
    expect(geometry.overflowY).toBe('auto');
    expect(geometry.scrollHeight).toBeGreaterThanOrEqual(geometry.clientHeight);
  });

  test('全S・全MISSION・全鬼攻略・ALL CLEARでMASTER CLEARになる', async ({ page }) => {
    await page.addInitScript(({ stages, onis }) => {
      localStorage.setItem('ningenkagu.completed', '1');
      for (const stageId of stages) {
        localStorage.setItem(`ningenkagu.rank.${stageId}`, 'S');
        localStorage.setItem(`ningenkagu.mission.${stageId}`, '1');
        for (const oniId of onis) {
          localStorage.setItem(`ningenkagu.oniClear.${stageId}.${oniId}`, '1');
        }
      }
    }, { stages: STAGES, onis: ONIS });

    await waitForApp(page);

    await expect(page.locator('#masteryTitle')).toContainText('MASTER CLEAR');
    await expect(page.locator('#masteryTitle')).toContainText('26/26');
    await expect(page.locator('#masteryDetail')).toContainText('S 5/5');
    await expect(page.locator('#masteryDetail')).toContainText('MISSION 5/5');
    await expect(page.locator('#masteryDetail')).toContainText('鬼攻略 15/15');
    await expect(page.locator('#masteryNext')).toContainText('完全制覇');
    await expect(page.locator('#masteryPanel')).toHaveAttribute('data-complete', 'true');
    await expect(page.locator('#masteryCompact')).toContainText('26/26');
    await expect(page.locator('#masteryCompact')).toHaveAttribute('data-complete', 'true');
  });

  test('ALL CLEAR後は最初の未達成Sランクを次の冠として示す', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('ningenkagu.completed', '1');
      localStorage.setItem('ningenkagu.rank.living', 'S');
    });

    await waitForApp(page);
    await expect(page.locator('#masteryTitle')).toContainText('2/26');
    await expect(page.locator('#masteryNext')).toContainText('教室でSランク');
    await expect(page.locator('#masteryCompact')).toHaveAttribute('title', /教室でSランク/);
  });
});
