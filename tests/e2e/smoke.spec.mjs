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

test.describe('モバイルのタイトルカード', () => {
  // css/style.css の html.title-card-open 系ルールと js/main.js の
  // touchmove スコープが噛み合って初めて、カード内が実際にスクロールできる。
  // どちらか片方でも壊れると「開くが操作できないカード」に戻ってしまう回帰。
  //
  // 実OSのタッチスクロール（CDP Input.dispatchTouchEvent 経由）で検証すると、
  // ジェスチャー認識がブラウザ/実行環境ごとに揺れて信頼できなかった
  // （このサンドボックスでは通ったが、GitHub Actions のランナーでは
  // 2回とも scrollTop が動かず失敗した）。そのため、実際に変更した
  // ロジックそのもの — main.js の touchmove ハンドラが `.tcard` 内では
  // preventDefault しないこと — を直接検証する決定的な形に置き換えてある。
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('あそびかたカードを開いて閉じられ、カード内のtouchmoveは抑止されない', async ({ page }) => {
    await page.goto('/index.html');
    await page.waitForFunction(() => !!window.__ningenkagu, null, { timeout: 15_000 });

    await expect(page.locator('.tl-side')).toBeHidden();

    await page.click('#btnHow');
    await expect(page.locator('html')).toHaveClass(/title-card-open/);
    await expect(page.locator('#cardHow')).toBeVisible();
    const closeBtn = page.locator('#cardHow .titleCardClose');
    await expect(closeBtn).toBeVisible();

    // カード内は touch-action: pan-y が効いていること（CSS側の担当）
    const touchAction = await page.evaluate(
      () => getComputedStyle(document.getElementById('cardHow')).touchAction,
    );
    expect(touchAction).toBe('pan-y');

    // main.js の document touchmove ハンドラは `.tcard` 内を対象から除外している
    // （main.js側の担当）。カード内では preventDefault されず、
    // カード外（ゲーム画面）では従来通り preventDefault されることを確認する。
    const insidePrevented = await page.evaluate(() => {
      const el = document.querySelector('#cardHow .tcard-p') || document.getElementById('cardHow');
      const ev = new Event('touchmove', { bubbles: true, cancelable: true });
      el.dispatchEvent(ev);
      return ev.defaultPrevented;
    });
    expect(insidePrevented).toBe(false);

    const outsidePrevented = await page.evaluate(() => {
      const ev = new Event('touchmove', { bubbles: true, cancelable: true });
      document.getElementById('scene').dispatchEvent(ev);
      return ev.defaultPrevented;
    });
    expect(outsidePrevented).toBe(true);

    await closeBtn.click();
    await expect(page.locator('html')).not.toHaveClass(/title-card-open/);
    await expect(page.locator('#btnHow')).toHaveAttribute('aria-expanded', 'false');
  });
});

test.describe('アクセシビリティ', () => {
  test('通知・トースト・ポップアップはスクリーンリーダー向けのライブリージョンになっている', async ({ page }) => {
    await page.goto('/index.html');
    await page.waitForFunction(() => !!window.__ningenkagu, null, { timeout: 15_000 });

    // #notice はかつて aria-hidden="true" で常時読み上げ対象から外れていた
    // （家具検査の開始・振り返りの予兆・ステージイベントなど、ゲームの根幹情報が
    // すべて視覚のみになっていた）。role="alert" は aria-hidden と両立しないので、
    // 属性ごと外れていることを確認する。
    await expect(page.locator('#notice')).not.toHaveAttribute('aria-hidden');
    await expect(page.locator('#notice')).toHaveAttribute('role', 'alert');
    await expect(page.locator('#toast')).toHaveAttribute('role', 'status');
    await expect(page.locator('#toast')).toHaveAttribute('aria-live', 'polite');
    await expect(page.locator('#popups')).toHaveAttribute('role', 'status');
    await expect(page.locator('#popups')).toHaveAttribute('aria-live', 'polite');

    // 実際に hud.toast() で文言が届くこと（ライブリージョンが空のまま、ではない）
    await page.evaluate(() => window.__ningenkagu.hud.toast('テスト通知'));
    await expect(page.locator('#toast')).toHaveText('テスト通知');
  });

  test('prefers-reduced-motion では明滅系のCSSアニメーションが止まる', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/index.html');
    await page.waitForFunction(() => !!window.__ningenkagu, null, { timeout: 15_000 });

    // js/utils.js の prefersReducedMotion() がページ内でも true を返すこと。
    // stageEvents.js の消灯イベント時のストロボはこれで無効化される
    // （イベントは開始10秒以降にしか起きないため、ここではフラグだけを確認する）。
    const flag = await page.evaluate(async () => {
      const { prefersReducedMotion } = await import('/js/utils.js');
      return prefersReducedMotion();
    });
    expect(flag).toBe(true);

    // 時間切迫の点滅・危険時の画面パルス・家具検査/警報の通知パルスが
    // reduced-motion 下では止まっていること（色・不透明度による表示は残る）
    const animName = (sel, addClass) => page.evaluate(({ sel, addClass }) => {
      const el = document.querySelector(sel);
      if (addClass) el.classList.add(addClass);
      return getComputedStyle(el).animationName;
    }, { sel, addClass });

    expect(await animName('#time', 'urgent')).toBe('none');
    expect(await animName('#warn', 'pulse')).toBe('none');
    expect(await animName('#notice', 'inspect')).toBe('none');
  });
});
