// 画面が低い端末（横持ちスマホ）でも、リザルトのボタンへ指が届くことを確かめる。
//
// html/body は overflow:hidden、#app 以下は touch-action:none で
// ピンチ・スクロールを止めている。そのままだとパネルが縦に収まらないとき
// 「もう一度遊ぶ」「タイトルへ」が画面外に出たきり操作できなくなるため、
// オーバーレイ（.screen）だけは自前のスクロール領域にしてある。
import { test, expect } from '@playwright/test';

// iPhone X / 一般的な Android の横持ちに相当する低い画面
const LANDSCAPE_PHONE = { width: 812, height: 375 };

async function playUntilResult(page) {
  await page.goto('/index.html');
  await page.waitForFunction(() => !!window.__ningenkagu, null, { timeout: 20_000 });
  await page.click('#btnStart');
  await page.waitForFunction(() => window.__ningenkagu.game.state === 'playing');
  // 実際のクリアと同じ経路を通す（ミッション・鬼攻略の行も足された状態にする）
  await page.evaluate(() => { window.__ningenkagu.game.timeLeft = 0.01; });
  await expect(page.locator('#result')).not.toHaveClass(/hidden/);
  // ミッション・鬼攻略の行は missionUi.js が後から足す。
  // パネルが一番高くなるのはこの2行が出そろってからなので、それを待つ。
  await expect(page.locator('#resultMissionStat')).toBeAttached();
  await expect(page.locator('#resultOniClearStat')).toBeAttached();
}

test.describe('低い画面でのリザルト表示', () => {
  test.use({ viewport: LANDSCAPE_PHONE });

  test('リザルトのボタンはスクロールして必ず画面内へ出せる', async ({ page }) => {
    await playUntilResult(page);

    const reach = await page.evaluate(() => {
      const screen = document.getElementById('result');
      screen.scrollTop = screen.scrollHeight;
      const rect = (id) => document.getElementById(id).getBoundingClientRect();
      return {
        scrollable: screen.scrollHeight > screen.clientHeight,
        scrolled: screen.scrollTop,
        retry: rect('btnRetry').bottom,
        title: rect('btnResultTitle').bottom,
        top: rect('btnRetry').top,
        vh: window.innerHeight,
      };
    });

    // パネルが収まりきらないなら、その分だけ実際にスクロールできていること
    if (reach.scrollable) expect(reach.scrolled).toBeGreaterThan(0);
    expect(reach.retry).toBeLessThanOrEqual(reach.vh);
    expect(reach.title).toBeLessThanOrEqual(reach.vh);
    expect(reach.top).toBeGreaterThanOrEqual(0);
  });

  test('リザルト内の touchmove は抑止されない（指でスクロールできる）', async ({ page }) => {
    await playUntilResult(page);

    const prevented = await page.evaluate(() => {
      const el = document.querySelector('#result .panel');
      const ev = new Event('touchmove', { bubbles: true, cancelable: true });
      el.dispatchEvent(ev);
      return ev.defaultPrevented;
    });
    expect(prevented).toBe(false);

    const touchAction = await page.evaluate(
      () => getComputedStyle(document.querySelector('#result .panel')).touchAction,
    );
    expect(touchAction).toBe('pan-y');
  });

  test('タイトルへ戻るボタンを実際に押せる', async ({ page }) => {
    await playUntilResult(page);
    await page.click('#btnResultTitle');
    await expect(page.locator('#title')).not.toHaveClass(/hidden/);
    await expect(page.locator('#result')).toHaveClass(/hidden/);
  });
});
