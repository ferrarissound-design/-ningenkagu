// エンドツーエンドのスモークテスト。
//
// 単体テストではカバーできない「実際のブラウザで動かした結果」を確認する。
// 特に以下の2つは、いずれもユニットテストでは検出できない回帰なので、
// 実ブラウザで renderer.info.memory と <audio> の再生状態を直接見る。
//   1. ステージ作り直し / タイトル復帰のたびに GPU リソースが増え続けないこと
//   2. BGM がボタンの id ではなくゲーム状態そのものに追従すること
import { test, expect } from '@playwright/test';

/** Audio コンストラクタを差し替えて、生成された全トラックを捕まえておく。 */
async function trackAudioElements(page) {
  await page.addInitScript(() => {
    window.__tracks = [];
    const OrigAudio = window.Audio;
    window.Audio = function Audio(src) {
      const a = new OrigAudio(src);
      window.__tracks.push(a);
      return a;
    };
    window.Audio.prototype = OrigAudio.prototype;
  });
}

function bgmState(page) {
  return page.evaluate(() => {
    const find = (part) => window.__tracks.find((a) => a.src.includes(part));
    const title = find('behind_the_potted_plant');
    const battle = find('gold_medal_morning');
    return {
      title: title ? (title.paused ? 'stop' : 'play') : null,
      battle: battle ? (battle.paused ? 'stop' : 'play') : null,
    };
  });
}

function rendererMemory(page) {
  return page.evaluate(() => ({ ...window.__ningenkagu.renderer.info.memory }));
}

test.describe('起動', () => {
  test('エラーなく起動し、タイトルが表示される', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));

    await page.goto('/index.html');
    await page.waitForFunction(() => !!window.__ningenkagu, null, { timeout: 15_000 });

    await expect(page.locator('#title')).toBeVisible();
    await expect(page.locator('#fatal')).toBeHidden();
    expect(errors).toEqual([]);
  });
});

test.describe('GPUリソースの解放', () => {
  test('ステージ切替とタイトル復帰を繰り返してもジオメトリ・テクスチャが増え続けない', async ({ page }) => {
    await page.goto('/index.html');
    await page.waitForFunction(() => !!window.__ningenkagu, null, { timeout: 15_000 });
    await page.waitForTimeout(400); // 初期シーンの構築が落ち着くのを待つ

    // 3ステージすべてを解放してから、そのうちの1つ（美術室）を基準にする。
    // ステージごとにジオメトリ数が違うので、基準値は切り替えループと
    // 同じ「最後に選ばれるステージ」で揃える。
    await page.evaluate(() => localStorage.setItem('ningenkagu.stageIndex', '2'));
    await page.reload();
    await page.waitForFunction(() => !!window.__ningenkagu, null, { timeout: 15_000 });
    await page.waitForTimeout(400);
    const base = await rendererMemory(page);

    // UIのステージチップ経由で何周も切り替える
    // （loadStage → game.dispose() の経路を、内部APIを直接叩かずに通す）
    for (let round = 0; round < 6; round++) {
      for (const id of ['0', '1', '2']) {
        await page.click(`[data-stage="${id}"]`);
      }
    }
    await page.waitForTimeout(300);
    const afterSwitches = await rendererMemory(page);

    // 開始 → ポーズ → 再開 → タイトルへ、という実際の操作導線も通す
    await page.click('#btnStart');
    await page.waitForTimeout(300);
    await page.click('#pauseBtn');
    await page.waitForTimeout(150);
    await page.click('#btnResume');
    await page.waitForTimeout(150);
    await page.click('#pauseBtn');
    await page.waitForTimeout(150);
    await page.click('#btnPauseTitle');
    await page.waitForTimeout(400);
    const backToTitle = await rendererMemory(page);

    expect(afterSwitches.geometries).toBe(base.geometries);
    expect(afterSwitches.textures).toBe(base.textures);
    expect(backToTitle.geometries).toBe(base.geometries);
    expect(backToTitle.textures).toBe(base.textures);
  });
});

test.describe('BGMの状態追従', () => {
  test('ゲームの状態遷移だけでBGMが切り替わる（ボタンIDを介さない）', async ({ page }) => {
    await trackAudioElements(page);
    await page.goto('/index.html');
    await page.waitForFunction(() => !!window.__ningenkagu, null, { timeout: 15_000 });
    await page.waitForTimeout(400);

    expect(await bgmState(page)).toEqual({ title: 'play', battle: 'stop' });

    // UI操作
    await page.click('#btnStart');
    await page.waitForTimeout(400);
    expect(await bgmState(page)).toEqual({ title: 'stop', battle: 'play' });

    await page.click('#pauseBtn');
    await page.waitForTimeout(200);
    expect(await bgmState(page)).toEqual({ title: 'stop', battle: 'stop' });

    await page.click('#btnResume');
    await page.waitForTimeout(200);
    expect(await bgmState(page)).toEqual({ title: 'stop', battle: 'play' });

    // ボタンを経由しない決着（内部から直接 lose() / win() を呼ぶケース）でも追従する
    await page.evaluate(() => window.__ningenkagu.game.lose());
    await page.waitForTimeout(300);
    expect(await bgmState(page)).toEqual({ title: 'stop', battle: 'stop' });

    await page.click('#btnRetry');
    await page.waitForTimeout(400);
    expect(await bgmState(page)).toEqual({ title: 'stop', battle: 'play' });
  });

  test('🔊ボタンと設定カードのどちらでミュートしても両方に反映される', async ({ page }) => {
    await trackAudioElements(page);
    await page.goto('/index.html');
    await page.waitForFunction(() => !!window.__ningenkagu, null, { timeout: 15_000 });
    await page.waitForTimeout(400);

    await page.click('#muteBtn');
    await page.waitForTimeout(200);
    expect(await bgmState(page)).toEqual({ title: 'stop', battle: 'stop' });
    await expect(page.locator('#muteBtn')).toHaveText('🔇');

    await page.click('#btnConfig');
    await expect(page.locator('#btnSound')).toHaveText('オフ');

    await page.click('#btnSound'); // 設定カード側から解除
    await page.waitForTimeout(200);
    expect(await bgmState(page)).toEqual({ title: 'play', battle: 'stop' });
    await expect(page.locator('#muteBtn')).toHaveText('🔊');
  });

  test('ポーズ中は戦闘BGMが進まず、再開すると続きから鳴る', async ({ page }) => {
    await trackAudioElements(page);
    await page.goto('/index.html');
    await page.waitForFunction(() => !!window.__ningenkagu, null, { timeout: 15_000 });

    const battleTime = () => page.evaluate(() => {
      const a = window.__tracks.find((t) => t.src.includes('gold_medal_morning'));
      return { t: a.currentTime, paused: a.paused };
    });

    await page.click('#btnStart');
    await page.waitForTimeout(1500);

    await page.evaluate(() => window.__ningenkagu.game.pause());
    const justPaused = await battleTime();
    await page.waitForTimeout(1000);
    const stillPaused = await battleTime();

    expect(justPaused.paused).toBe(true);
    expect(stillPaused.paused).toBe(true);
    expect(Math.abs(stillPaused.t - justPaused.t)).toBeLessThan(0.05);

    await page.evaluate(() => window.__ningenkagu.game.resume());
    await page.waitForTimeout(300);
    const resumed = await battleTime();
    expect(resumed.paused).toBe(false);
    expect(resumed.t).toBeGreaterThanOrEqual(justPaused.t);
  });

  test('リトライすると戦闘BGMが頭出しされる', async ({ page }) => {
    await trackAudioElements(page);
    await page.goto('/index.html');
    await page.waitForFunction(() => !!window.__ningenkagu, null, { timeout: 15_000 });

    await page.click('#btnStart');
    await page.waitForTimeout(1500); // 曲を進めておく

    await page.evaluate(() => window.__ningenkagu.game.lose());
    await page.waitForTimeout(200);
    await page.click('#btnRetry');
    await page.waitForTimeout(300);

    const t = await page.evaluate(() => {
      const a = window.__tracks.find((tr) => tr.src.includes('gold_medal_morning'));
      return a.currentTime;
    });
    expect(t).toBeLessThan(1.0);
  });
});
