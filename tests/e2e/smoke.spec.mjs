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
    await expect(page.locator('#loading')).toBeHidden();
    expect(errors).toEqual([]);
  });

  test('読み込み中は#loadingが前面に出て、boot()完了で消える', async ({ page }) => {
    // JSモジュールの取得に時間がかかっている間、静的HTMLのタイトル画面
    // （ボタン等）が先に操作できてしまわないよう #loading で覆う。
    // ローカルではスクリプトの取得が一瞬で終わるため、意図的に main.js の
    // レスポンスを遅らせて「読み込み中の見え方」を決定的に再現する。
    let releaseMain;
    const held = new Promise((resolve) => { releaseMain = resolve; });
    await page.route('**/js/main.js', async (route) => {
      await held;
      await route.continue();
    });

    const gotoPromise = page.goto('/index.html');
    // main.js が止まっている間は #loading が見えていて、まだ __ningenkagu も無い
    await expect(page.locator('#loading')).toBeVisible();
    await expect(page.locator('#loading')).toHaveAttribute('role', 'status');
    expect(await page.evaluate(() => !!window.__ningenkagu)).toBe(false);

    releaseMain();
    await gotoPromise;
    await page.waitForFunction(() => !!window.__ningenkagu, null, { timeout: 15_000 });
    await expect(page.locator('#loading')).toBeHidden();
  });
});

test.describe('GPUリソースの解放', () => {
  test('ステージ切替とタイトル復帰を繰り返してもジオメトリ・テクスチャが増え続けない', async ({ page }) => {
    // 18回ぶんのステージ作り直し（部屋一式の生成と解放）を実際に通すため、
    // ソフトウェアGLのCIでは既定の30秒にぎりぎり収まらないことがある。
    // 検査内容は変えず、この1本だけ時間を多めに取る。
    test.slow();
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

/** navigator.getGamepads を差し替え、テストから直接操作できる疑似ゲームパッドを用意する。 */
async function stubGamepad(page) {
  await page.addInitScript(() => {
    window.__pad = {
      connected: true,
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 12 }, () => ({ pressed: false })),
    };
    navigator.getGamepads = () => [window.__pad];
  });
}

function setPadAxes(page, axes) {
  return page.evaluate((axes) => { window.__pad.axes = axes; }, axes);
}

/** ボタンを1フレーム分だけ押して離す（edge-triggered な消費なので押しっぱなしにしない） */
async function tapPadButton(page, index) {
  await page.evaluate((i) => { window.__pad.buttons[i].pressed = true; }, index);
  await page.waitForTimeout(120);
  await page.evaluate((i) => { window.__pad.buttons[i].pressed = false; }, index);
  await page.waitForTimeout(120);
}

test.describe('設定', () => {
  test('BGM音量・効果音音量・視点感度・Y軸反転をスライダー/ボタンで変更でき、リロード後も保持される', async ({ page }) => {
    await page.goto('/index.html');
    await page.waitForFunction(() => !!window.__ningenkagu, null, { timeout: 15_000 });
    await page.click('#btnConfig');

    await expect(page.locator('#bgmVolumeVal')).toHaveText('100%');
    await expect(page.locator('#sensitivityVal')).toHaveText('100%');
    await expect(page.locator('#btnInvertY')).toHaveText('オフ');

    await page.locator('#rangeBgmVolume').fill('40');
    await page.locator('#rangeBgmVolume').dispatchEvent('input');
    await expect(page.locator('#bgmVolumeVal')).toHaveText('40%');
    const bgmVol = await page.evaluate(async () => (await import('/js/audio.js')).getBgmVolume());
    expect(bgmVol).toBeCloseTo(0.4, 5);

    await page.locator('#rangeSensitivity').fill('150');
    await page.locator('#rangeSensitivity').dispatchEvent('input');
    await expect(page.locator('#sensitivityVal')).toHaveText('150%');
    expect(await page.evaluate(() => window.__ningenkagu.input.lookSensitivity)).toBeCloseTo(1.5, 5);

    await page.click('#btnInvertY');
    await expect(page.locator('#btnInvertY')).toHaveText('オン');
    expect(await page.evaluate(() => window.__ningenkagu.input.invertY)).toBe(true);

    // localStorage への保存とリロード後の復元
    await page.reload();
    await page.waitForFunction(() => !!window.__ningenkagu, null, { timeout: 15_000 });
    await page.click('#btnConfig');
    await expect(page.locator('#bgmVolumeVal')).toHaveText('40%');
    await expect(page.locator('#sensitivityVal')).toHaveText('150%');
    await expect(page.locator('#btnInvertY')).toHaveText('オン');
    expect(await page.evaluate(() => window.__ningenkagu.input.lookSensitivity)).toBeCloseTo(1.5, 5);
    expect(await page.evaluate(() => window.__ningenkagu.input.invertY)).toBe(true);
  });
});

test.describe('ゲームパッド', () => {
  test('左スティックで移動、右スティックで視点操作、ボタンでポーズ切替ができる', async ({ page }) => {
    await stubGamepad(page);
    await page.goto('/index.html');
    await page.waitForFunction(() => !!window.__ningenkagu, null, { timeout: 15_000 });

    // syncGamepadStatus() は起動時に navigator.getGamepads() を直接見るので、
    // gamepadconnected イベントを待たずに検出できる
    await expect(page.locator('#gamepadStatus')).toHaveText('接続済み');

    await page.click('#btnStart');
    await page.waitForTimeout(300);

    const posBefore = await page.evaluate(() => ({ ...window.__ningenkagu.game.player.position }));
    await setPadAxes(page, [1, 0, 0, 0]); // 左スティックを右へ全開
    await page.waitForTimeout(500);
    const posAfter = await page.evaluate(() => ({ ...window.__ningenkagu.game.player.position }));
    const moved = Math.hypot(posAfter.x - posBefore.x, posAfter.z - posBefore.z);
    expect(moved).toBeGreaterThan(0.1);
    await setPadAxes(page, [0, 0, 0, 0]);

    const yawBefore = await page.evaluate(() => window.__ningenkagu.game.camYaw);
    await setPadAxes(page, [0, 0, 1, 0]); // 右スティックを右へ全開
    await page.waitForTimeout(300);
    const yawAfter = await page.evaluate(() => window.__ningenkagu.game.camYaw);
    expect(yawAfter).not.toBeCloseTo(yawBefore, 3);
    await setPadAxes(page, [0, 0, 0, 0]);

    const poseBefore = await page.evaluate(() => window.__ningenkagu.game.player.pose);
    await tapPadButton(page, 1); // ポーズ切替ボタン
    const poseAfter = await page.evaluate(() => window.__ningenkagu.game.player.pose);
    expect(poseAfter).not.toBe(poseBefore);
  });

  test('確認ボタン（擬態と同じボタン）でタイトルから開始でき、カードを開いている間は無視される', async ({ page }) => {
    await stubGamepad(page);
    await page.goto('/index.html');
    await page.waitForFunction(() => !!window.__ningenkagu, null, { timeout: 15_000 });

    await expect.poll(() => page.evaluate(() => window.__ningenkagu.game.state)).toBe('title');
    await tapPadButton(page, 0);
    await expect.poll(() => page.evaluate(() => window.__ningenkagu.game.state)).toBe('playing');

    // タイトルへ戻し、カードを開いた状態で確認ボタンを押しても暴発しないこと
    await page.evaluate(() => window.__ningenkagu.game.lose());
    await page.waitForTimeout(200);
    await page.click('#btnResultTitle');
    await expect.poll(() => page.evaluate(() => window.__ningenkagu.game.state)).toBe('title');

    await page.click('#btnHow');
    await expect(page.locator('html')).toHaveClass(/title-card-open/);
    await tapPadButton(page, 0);
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => window.__ningenkagu.game.state)).toBe('title');
  });
});

test.describe('共有メタデータ', () => {
  // OGP や manifest の不備は「SNSに貼るまで気づけない」類の壊れ方をする
  // （タグの綴り間違い、画像の寸法違い、パスのtypo など）。
  // 実ブラウザから宣言と実体の両方を突き合わせて固定しておく。
  test('OGP/Twitter Card のタグが揃い、画像が宣言どおりの寸法で実在する', async ({ page }) => {
    await page.goto('/index.html');
    await page.waitForFunction(() => !!window.__ningenkagu, null, { timeout: 15_000 });

    const meta = (sel, attr = 'content') => page.evaluate(
      ({ sel, attr }) => document.querySelector(sel)?.getAttribute(attr) ?? null,
      { sel, attr },
    );

    expect(await meta('meta[property="og:title"]')).toBe('ニンゲン家具');
    expect(await meta('meta[property="og:type"]')).toBe('website');
    expect(await meta('meta[name="twitter:card"]')).toBe('summary_large_image');
    expect(await meta('meta[property="og:description"]')).toBeTruthy();
    expect(await meta('meta[property="og:image:alt"]')).toBeTruthy();

    // og:image と og:url は仕様上そのままクロールされるので絶対URLでなければならない。
    // 相対パスにしてしまうとカードが出ないが、ローカルでは何も起きないので気づけない。
    for (const sel of ['meta[property="og:image"]', 'meta[property="og:url"]']) {
      expect(await meta(sel)).toMatch(/^https:\/\//);
    }

    // 宣言した寸法と実際の画像が食い違うと、切れたカードが表示される
    const declared = {
      w: Number(await meta('meta[property="og:image:width"]')),
      h: Number(await meta('meta[property="og:image:height"]')),
    };
    const actual = await page.evaluate(() => new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => resolve(null);
      img.src = 'assets/ogp.jpg';
    }));
    expect(actual, 'assets/ogp.jpg が取得できること').not.toBeNull();
    expect(actual).toEqual(declared);
  });

  test('manifest.json が取得でき、宣言したアイコンが実在する', async ({ page }) => {
    await page.goto('/index.html');
    await page.waitForFunction(() => !!window.__ningenkagu, null, { timeout: 15_000 });

    expect(await page.evaluate(
      () => document.querySelector('link[rel="manifest"]')?.getAttribute('href') ?? null,
    )).toBe('manifest.json');

    const manifest = await page.evaluate(async () => {
      const r = await fetch('manifest.json');
      return r.ok ? r.json() : null;
    });
    expect(manifest, 'manifest.json が200で返ること').not.toBeNull();
    expect(manifest.name).toBe('ニンゲン家具');
    expect(manifest.icons.length).toBeGreaterThan(0);

    // manifest が指すアイコンが、宣言した sizes どおりに実在すること
    for (const icon of manifest.icons) {
      const [w, h] = icon.sizes.split('x').map(Number);
      const actual = await page.evaluate((src) => new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
        img.onerror = () => resolve(null);
        img.src = src;
      }), icon.src);
      expect(actual, `${icon.src} が取得できること`).not.toBeNull();
      expect(actual, `${icon.src} が ${icon.sizes} であること`).toEqual({ w, h });
    }
  });
});
