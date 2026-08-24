// エントリポイント：レンダラ・ライト・ゲームループ・UI配線
import * as THREE from '../vendor/three/three.module.min.js';
import { Game } from './game.js';
import { Hud } from './hud.js';
import { Input } from './input.js';
import { initAudio, setMuted, isMuted } from './audio.js';
import { ONI_PERSONALITIES, setForcedOniPersonality, getForcedOniPersonality } from './oni.js';

const MUTE_KEY = 'ningenkagu.muted';
const STAGE_KEY = 'ningenkagu.stageIndex';
const STAGES = [
  { id: 'living', label: 'STAGE 1　リビング', name: 'リビング', clearNote: 'リビング突破！ 次は机とロッカーだらけの教室。鬼の巡回路も変わる。' },
  { id: 'classroom', label: 'STAGE 2　教室', name: '教室', clearNote: '教室突破！ 次は石膏像とイーゼルが並ぶ美術室。真っ白な像に紛れ込め。' },
  { id: 'artroom', label: 'STAGE 3　美術室', name: '美術室', clearNote: '' },
];

// 各ステージの開始直後に「部屋の中が見える」構図を作る。
// 壁際スポーンのままだとカメラが壁に押されて極端に近くなるため、
// 開始位置を少しだけ内側へ寄せ、カメラ前方が攻略エリアへ向くようにする。
const START_VIEWS = {
  living: {
    position: [-4.8, 0, -3.2],
    yaw: -2.20,
    pitch: 0.48,
  },
  classroom: {
    position: [-2.2, 0, 2.0],
    yaw: -Math.PI / 4,
    pitch: 0.48,
  },
  artroom: {
    position: [4.0, 0, -2.4],
    yaw: 2.15,
    pitch: 0.48,
  },
};

/** 前回クリアまで進んだステージから再開できるようにする */
function loadSavedStageIndex() {
  try {
    const v = parseInt(localStorage.getItem(STAGE_KEY) || '0', 10);
    return Number.isFinite(v) ? Math.max(0, Math.min(STAGES.length - 1, v)) : 0;
  } catch (e) {
    return 0;
  }
}

function saveStageIndex(index) {
  try { localStorage.setItem(STAGE_KEY, String(index)); } catch (e) { /* 保存できなくても続行 */ }
}

/** 起動できなかった理由を画面に出す（真っ暗なまま放置しない） */
function showFatal(message) {
  const el = document.getElementById('fatal');
  const note = document.getElementById('fatalNote');
  if (note) note.textContent = message;
  if (el) el.classList.remove('hidden');
}

function createRenderer(canvas) {
  try {
    return new THREE.WebGLRenderer({
      canvas,
      antialias: window.devicePixelRatio < 2,
      powerPreference: 'high-performance',
    });
  } catch (err) {
    console.error(err);
    return null;
  }
}

function boot(renderer) {
  const isTouch = matchMedia('(pointer: coarse)').matches;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isTouch ? 1.6 : 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // タイトル中は背景を明るめにする。真っ黒だと色かぶせが乗らず、
  // 壁より上が黒帯として残ってしまうため。
  const TITLE_BG = new THREE.Color(0x3a4258);
  const PLAY_BG = new THREE.Color(0x14161c);

  const scene = new THREE.Scene();
  scene.background = TITLE_BG;
  scene.fog = new THREE.Fog(0x14161c, 22, 40);

  const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 100);

  // ライト（軽め）
  scene.add(new THREE.HemisphereLight(0xdfe6ef, 0x3b3126, 1.15));
  const sun = new THREE.DirectionalLight(0xfff1dd, 1.35);
  sun.position.set(6, 11, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -12;
  sun.shadow.camera.right = 12;
  sun.shadow.camera.top = 10;
  sun.shadow.camera.bottom = -10;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 30;
  sun.shadow.bias = -0.0012;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0x9fb6d4, 0.45);
  fill.position.set(-7, 6, -6);
  scene.add(fill);

  const hud = new Hud();
  // 保存値は「到達した最高ステージ」。起動時はそこを選んだ状態から始める。
  let unlockedMax = loadSavedStageIndex();
  let stageIndex = unlockedMax;
  globalThis.__ningenkaguStage = STAGES[stageIndex].id;
  hud.setStage(STAGES[stageIndex].id);
  let game = new Game(scene, camera, hud);

  const input = new Input(renderer.domElement, {
    stickEl: document.getElementById('stick'),
    knobEl: document.getElementById('knob'),
  });

  // ---- 画面サイズ ----
  // 縦持ちでも横方向の視野が極端に狭くならないよう FOV を補正する
  const BASE_FOV = 58;
  const BASE_ASPECT = 1.6;
  const BASE_HTAN = Math.tan((BASE_FOV * Math.PI) / 360) * BASE_ASPECT;

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    const aspect = w / Math.max(1, h);
    camera.aspect = aspect;
    camera.fov = aspect >= BASE_ASPECT
      ? BASE_FOV
      : Math.min(82, (2 * Math.atan(BASE_HTAN / aspect) * 180) / Math.PI);
    camera.updateProjectionMatrix();
    // 縦持ちは少し引いて周囲を見やすくする
    game.camDist = aspect < 1 ? 6.4 : 5.4;
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 250));
  resize();

  // ---- ピンチ拡大への追従 ----
  // iOS Safari は user-scalable=no を無視するので拡大自体は防げない。
  // 拡大されると HUD やボタンが画面の外へ出て「メーターが欠けた」状態になるため、
  // UI レイヤだけを実際に見えている範囲（visual viewport）へ合わせ直す。
  const vv = window.visualViewport;
  const vpLayers = ['ui', 'warn', 'title', 'pause', 'result', 'fatal']
    .map((id) => document.getElementById(id))
    .filter(Boolean);

  function syncViewportLayers() {
    if (!vv) return;
    const scale = vv.scale || 1;
    // 等倍のときは素の inset: 0 に任せる（transform を残すと描画が甘くなる）
    const plain = scale < 1.01 && Math.abs(vv.offsetLeft) < 0.5 && Math.abs(vv.offsetTop) < 0.5;
    for (const el of vpLayers) {
      if (plain) {
        el.style.width = '';
        el.style.height = '';
        el.style.transform = '';
        continue;
      }
      // 見えている矩形にレイヤを重ね、拡大率を打ち消して元の大きさで表示する
      el.style.width = `${vv.width * scale}px`;
      el.style.height = `${vv.height * scale}px`;
      el.style.transform =
        `translate(${vv.offsetLeft}px, ${vv.offsetTop}px) scale(${1 / scale})`;
    }
  }
  if (vv) {
    vv.addEventListener('resize', syncViewportLayers);
    vv.addEventListener('scroll', syncViewportLayers);
    window.addEventListener('orientationchange', () => setTimeout(syncViewportLayers, 260));
    syncViewportLayers();
  }

  // ---- UI 配線 ----
  const appEl = document.getElementById('app');
  const titleEl = document.getElementById('title');
  const uiEl = document.getElementById('ui');
  const btnStart = document.getElementById('btnStart');
  const btnRetry = document.getElementById('btnRetry');
  const btnResume = document.getElementById('btnResume');
  const btnMimic = document.getElementById('btnMimic');
  const btnPose = document.getElementById('btnPose');
  const btnPause = document.getElementById('pauseBtn');
  const muteBtn = document.getElementById('muteBtn');
  const resultNote = document.getElementById('resultNote');
  const btnHow = document.getElementById('btnHow');
  const btnConfig = document.getElementById('btnConfig');
  const btnSound = document.getElementById('btnSound');
  const selStageName = document.getElementById('selStageName');
  const selStageBest = document.getElementById('selStageBest');
  const stageBtns = [...document.querySelectorAll('[data-stage]')];
  const cards = {
    info: document.getElementById('cardInfo'),
    how: document.getElementById('cardHow'),
    config: document.getElementById('cardConfig'),
  };

  appEl.classList.add('titlemode');

  /**
   * iOS / WebView では pointerdown が取りこぼされる場合があるため、
   * 実処理はブラウザ標準の click に一本化する。pointer 系は押下演出だけに使う。
   */
  function bindTap(el, fn) {
    if (!el) return;
    el.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      try {
        fn();
      } catch (err) {
        console.error(err);
        showFatal('ゲームの処理中にエラーが発生しました。ページを再読み込みしてもう一度お試しください。');
      }
    });
    el.addEventListener('pointerdown', () => el.classList.add('active'));
    const clear = () => el.classList.remove('active');
    el.addEventListener('pointerup', clear);
    el.addEventListener('pointercancel', clear);
    el.addEventListener('pointerleave', clear);
    el.addEventListener('touchend', clear, { passive: true });
  }

  /** ステージ切替時に旧ゲームの3Dオブジェクトを scene から外す。 */
  function removeOldGameWorld(oldGame) {
    if (!oldGame) return;
    if (oldGame.stage?.group) scene.remove(oldGame.stage.group);
    if (oldGame.player?.root) scene.remove(oldGame.player.root);
    if (oldGame.oni?.root) scene.remove(oldGame.oni.root);
    if (oldGame.fx?.marker) scene.remove(oldGame.fx.marker);
    const rings = [...(oldGame.fx?.rings || []), ...(oldGame.fx?.pool || [])];
    for (const ring of new Set(rings)) scene.remove(ring);
  }

  /** ステージ選択チップと情報カードの表示を、今の選択・解放状態に合わせる。 */
  function syncStageUi() {
    for (const btn of stageBtns) {
      const i = Number(btn.dataset.stage);
      const locked = i > unlockedMax;
      btn.disabled = locked;
      btn.textContent = (locked ? '🔒 ' : '') + (i + 1) + '　' + STAGES[i].name;
      btn.classList.toggle('on', i === stageIndex && !locked);
      btn.setAttribute('aria-pressed', String(i === stageIndex));
      btn.title = locked ? '前のステージをクリアすると解放されます' : '';
    }
    if (selStageName) selStageName.textContent = STAGES[stageIndex].name;
    if (selStageBest) selStageBest.textContent = hud.best.toLocaleString('en-US');
  }

  function loadStage(index) {
    stageIndex = Math.max(0, Math.min(STAGES.length - 1, index));
    // 解放状態は最高到達点で保存する。下の面を選び直しても巻き戻さない。
    unlockedMax = Math.max(unlockedMax, stageIndex);
    saveStageIndex(unlockedMax);
    removeOldGameWorld(game);
    globalThis.__ningenkaguStage = STAGES[stageIndex].id;
    hud.setStage(STAGES[stageIndex].id);
    game = new Game(scene, camera, hud);
    resize();
    syncStageUi();
    if (window.__ningenkagu) window.__ningenkagu.game = game;
  }

  /** 右のカードを切り替える。同じボタンをもう一度押すと基本情報に戻る。 */
  let openCard = 'info';
  function showCard(which) {
    openCard = (openCard === which && which !== 'info') ? 'info' : which;
    for (const [key, el] of Object.entries(cards)) {
      if (el) el.classList.toggle('hidden', key !== openCard);
    }
    if (btnHow) btnHow.setAttribute('aria-expanded', String(openCard === 'how'));
    if (btnConfig) btnConfig.setAttribute('aria-expanded', String(openCard === 'config'));
  }

  /**
   * スタート時だけステージ専用の見やすい構図を適用する。
   * キャラもカメラ前方へ向けておき、最初の一歩が自然に攻略エリアへ入るようにする。
   */
  function applyStageStartView() {
    const cfg = START_VIEWS[STAGES[stageIndex].id];
    if (!cfg) return;

    game.player.reset(new THREE.Vector3(...cfg.position));
    game.camYaw = cfg.yaw;
    game.camPitch = cfg.pitch;

    const forwardYaw = Math.atan2(-Math.sin(game.camYaw), -Math.cos(game.camYaw));
    game.player.yaw = forwardYaw;
    game.player.root.rotation.y = forwardYaw;
    game.updateCamera(0.5, true);
  }

  function beginCurrentStage() {
    initAudio();
    hud.resetVisuals();
    hud.hideResult();
    // 先にゲーム本体の開始が成功したことを確認してからタイトルを隠す。
    // 起動エラー時に「押したのに真っ暗」になるのを防ぐ。
    game.start();
    applyStageStartView();
    titleEl.classList.add('hidden');
    appEl.classList.remove('titlemode');
    scene.background = PLAY_BG;
    uiEl.classList.add('playing');
    hud.toast(STAGES[stageIndex].label + '　隠れろ！');
    input.setEnabled(true);
  }

  /** 勝利かつ次のステージがあるときだけ進み、それ以外は現在の面をリトライする。 */
  function startFromCurrentScreen() {
    if (game.state === 'win' && stageIndex < STAGES.length - 1) {
      loadStage(stageIndex + 1);
    }
    beginCurrentStage();
  }

  bindTap(btnStart, beginCurrentStage);
  bindTap(btnRetry, startFromCurrentScreen);
  bindTap(btnMimic, () => input.pressMimic());
  bindTap(btnPose, () => input.pressPose());
  bindTap(btnPause, () => game.togglePause());
  bindTap(btnResume, () => game.resume());
  bindTap(btnHow, () => showCard('how'));
  bindTap(btnConfig, () => showCard('config'));
  const toggleMute = () => {
    initAudio();
    applyMuted(!isMuted());
  };
  bindTap(muteBtn, toggleMute);
  bindTap(btnSound, toggleMute);

  for (const btn of stageBtns) {
    bindTap(btn, () => {
      const i = Number(btn.dataset.stage);
      if (i > unlockedMax || i === stageIndex) return;
      loadStage(i);
    });
  }
  syncStageUi();

  /** 音のオン / オフ。HUD の 🔊 と設定カードのボタンは同じ状態を指す。 */
  function applyMuted(m) {
    setMuted(m);
    muteBtn.textContent = m ? '🔇' : '🔊';
    muteBtn.setAttribute('aria-pressed', String(m));
    if (btnSound) {
      btnSound.textContent = m ? 'オフ' : 'オン';
      btnSound.classList.toggle('on', !m);
      btnSound.setAttribute('aria-pressed', String(!m));
    }
    try { localStorage.setItem(MUTE_KEY, m ? '1' : '0'); } catch (e) { /* 保存できなくても続行 */ }
  }

  let savedMute = false;
  try { savedMute = localStorage.getItem(MUTE_KEY) === '1'; } catch (e) { /* noop */ }
  applyMuted(savedMute);

  hud.onResultChange = (shown) => {
    if (shown) {
      input.setEnabled(false);
      uiEl.classList.remove('playing');
      const hasNext = game.state === 'win' && stageIndex < STAGES.length - 1;
      if (btnRetry) {
        btnRetry.textContent = hasNext
          ? '次のステージへ'
          : (stageIndex === STAGES.length - 1 && game.state === 'win' ? STAGES[stageIndex].name + 'をもう一度' : 'もう一度遊ぶ');
      }
      if (hasNext && resultNote) {
        resultNote.textContent = STAGES[stageIndex].clearNote;
      }
    }
  };

  // タイトル・リザルトはキーボードだけでも進められるようにする
  window.addEventListener('keydown', (e) => {
    if (input.enabled || e.repeat) return;
    if (e.code !== 'Enter' && e.code !== 'Space') return;
    if (document.activeElement && document.activeElement.tagName === 'BUTTON') return;
    e.preventDefault();
    startFromCurrentScreen();
  });

  // スクロール・ピンチズームの抑止
  document.addEventListener('touchmove', (e) => { e.preventDefault(); }, { passive: false });
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault());

  // ---- メインループ ----
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    try {
      game.update(dt, input);
    } catch (err) {
      console.error(err);
    }
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // タブ復帰時に大きな dt を出さない。離れている間に発見されないよう自動ポーズする
  document.addEventListener('visibilitychange', () => {
    last = performance.now();
    if (document.hidden) game.pause();
  });
  window.addEventListener('blur', () => game.pause());

  // デバッグ用に少しだけ公開（画面には何も出さない）
  window.__ningenkagu = {
    game, input, hud, renderer, THREE, stages: STAGES,
    // 今の鬼のタイプは __ningenkagu.game.oni.personality で見られる
    personalities: ONI_PERSONALITIES,
    // 次のゲームの鬼タイプを固定する。null / 不正な id で通常のランダムへ戻す
    setOniPersonality: (id) => setForcedOniPersonality(id),
    getOniPersonality: () => getForcedOniPersonality(),
  };
}

const canvas = document.getElementById('scene');
const renderer = createRenderer(canvas);
if (renderer) {
  try {
    boot(renderer);
  } catch (err) {
    console.error(err);
    showFatal('ゲームの初期化に失敗しました。ページを再読み込みしてもう一度お試しください。');
  }
} else {
  showFatal('このブラウザ・端末では WebGL を利用できないため、ゲームを表示できませんでした。別のブラウザでお試しください。');
}
