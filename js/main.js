// エントリポイント：レンダラ・ライト・ゲームループ・UI配線
import * as THREE from '../vendor/three/three.module.min.js';
import { Game } from './game.js';
import { Hud, loadBestRank } from './hud.js';
import { Input } from './input.js';
import {
  initAudio, setMuted, isMuted,
  setBgmVolume, setSfxVolume,
} from './audio.js';
import { ONI_PERSONALITIES, setForcedOniPersonality, getForcedOniPersonality } from './oniPersonalities.js';
import { STAGE_EVENTS } from './stageEvents.js';
import { STAGE_DEFINITIONS as STAGES } from './stageRegistry.js';
import { normalizeSettingNumber } from './settings.js';
import { GAME_MODE, kishinProgress, loadKishinClear, saveKishinClear } from './gameModes.js';

const MUTE_KEY = 'ningenkagu.muted';
const BGM_VOLUME_KEY = 'ningenkagu.bgmVolume';
const SFX_VOLUME_KEY = 'ningenkagu.sfxVolume';
const SENSITIVITY_KEY = 'ningenkagu.lookSensitivity';
const INVERT_Y_KEY = 'ningenkagu.invertY';
const STAGE_KEY = 'ningenkagu.stageIndex';

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

/** 読み込み中の案内を消す。起動が成功しても失敗しても、この状態には留めない */
function hideLoading() {
  document.getElementById('loading')?.classList.add('hidden');
}

/** 起動できなかった理由を画面に出す（真っ暗なまま放置しない） */
function showFatal(message) {
  hideLoading();
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
  const hemi = new THREE.HemisphereLight(0xdfe6ef, 0x3b3126, 1.15);
  scene.add(hemi);
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

  // 美術室の消灯イベント用。元の明るさを添えて渡し、必ずここへ戻せるようにする
  scene.userData.stageLights = {
    hemi: { light: hemi, base: hemi.intensity },
    sun: { light: sun, base: sun.intensity },
    fill: { light: fill, base: fill.intensity },
  };

  const hud = new Hud();
  // 保存値は「到達した最高ステージ」。起動時はそこを選んだ状態から始める。
  let unlockedMax = loadSavedStageIndex();
  let stageIndex = unlockedMax;
  globalThis.__ningenkaguStage = STAGES[stageIndex].id;
  hud.setStage(STAGES[stageIndex].id);
  let selectedGameMode = GAME_MODE.NORMAL;
  let game = new Game(scene, camera, hud, { mode: selectedGameMode });

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
  const btnPauseTitle = document.getElementById('btnPauseTitle');
  const btnResultTitle = document.getElementById('btnResultTitle');
  const btnMimic = document.getElementById('btnMimic');
  const btnPose = document.getElementById('btnPose');
  const btnDecoy = document.getElementById('btnDecoy');
  const btnPause = document.getElementById('pauseBtn');
  const muteBtn = document.getElementById('muteBtn');
  const resultNote = document.getElementById('resultNote');
  const btnHow = document.getElementById('btnHow');
  const btnConfig = document.getElementById('btnConfig');
  const btnTraining = document.getElementById('btnTraining');
  const btnKishin = document.getElementById('btnKishin');
  const kishinProgressEl = document.getElementById('kishinProgress');
  const kishinMasterBadge = document.getElementById('kishinMasterBadge');
  const btnSound = document.getElementById('btnSound');
  const rangeBgmVolume = document.getElementById('rangeBgmVolume');
  const bgmVolumeVal = document.getElementById('bgmVolumeVal');
  const rangeSfxVolume = document.getElementById('rangeSfxVolume');
  const sfxVolumeVal = document.getElementById('sfxVolumeVal');
  const rangeSensitivity = document.getElementById('rangeSensitivity');
  const sensitivityVal = document.getElementById('sensitivityVal');
  const btnInvertY = document.getElementById('btnInvertY');
  const gamepadStatus = document.getElementById('gamepadStatus');
  const selStageName = document.getElementById('selStageName');
  const selStageBest = document.getElementById('selStageBest');
  const selStageRank = document.getElementById('selStageRank');

  // ステージ定義を増やしても静的HTMLのボタン追加を忘れないよう、不足分はここで補う。
  const stageBar = document.querySelector('.tl-bottom');
  if (stageBar) {
    for (let i = 0; i < STAGES.length; i++) {
      if (stageBar.querySelector(`[data-stage="${i}"]`)) continue;
      const btn = document.createElement('button');
      btn.className = 'chipbtn';
      btn.type = 'button';
      btn.dataset.stage = String(i);
      btn.textContent = `${i + 1}　${STAGES[i].name}`;
      stageBar.appendChild(btn);
    }
  }
  const stageBtns = [...document.querySelectorAll('[data-stage]')];
  const cards = {
    info: document.getElementById('cardInfo'),
    how: document.getElementById('cardHow'),
    config: document.getElementById('cardConfig'),
    training: document.getElementById('cardTraining'),
    kishin: document.getElementById('cardKishin'),
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

  /** ステージ選択チップと情報カードの表示を、今の選択・解放状態に合わせる。 */
  function syncStageUi() {
    for (const btn of stageBtns) {
      const i = Number(btn.dataset.stage);
      const locked = i > unlockedMax;
      const bestRank = locked ? null : loadBestRank(STAGES[i].id);
      const kishinClear = !locked && loadKishinClear(STAGES[i].id);
      btn.disabled = locked;
      btn.textContent = (locked ? '🔒 ' : '') + (i + 1) + '　' + STAGES[i].name
        + (bestRank ? '　' + bestRank : '') + (kishinClear ? '　🔥' : '');
      btn.classList.toggle('on', i === stageIndex && !locked);
      btn.setAttribute('aria-pressed', String(i === stageIndex));
      btn.title = locked ? '前のステージをクリアすると解放されます' : (bestRank ? `ベストランク ${bestRank}` : '未クリア');
    }
    if (selStageName) selStageName.textContent = STAGES[stageIndex].name;
    if (selStageBest) selStageBest.textContent = hud.best.toLocaleString('en-US');
    if (selStageRank) selStageRank.textContent = hud.bestRank || '-';
  }

  function loadStage(index) {
    stageIndex = Math.max(0, Math.min(STAGES.length - 1, index));
    // 解放状態は最高到達点で保存する。下の面を選び直しても巻き戻さない。
    unlockedMax = Math.max(unlockedMax, stageIndex);
    saveStageIndex(unlockedMax);
    // 旧ステージは scene から外すだけでなく GPU リソースまで解放する。
    // ここを飛ばすと、ステージを切り替えるたびに部屋一式がメモリに残る。
    game?.dispose();
    globalThis.__ningenkaguStage = STAGES[stageIndex].id;
    hud.setStage(STAGES[stageIndex].id);
    game = new Game(scene, camera, hud, { mode: selectedGameMode });
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
    if (btnTraining) btnTraining.setAttribute('aria-expanded', String(openCard === 'training'));
    if (btnKishin) btnKishin.setAttribute('aria-expanded', String(openCard === 'kishin'));
  }

  const trainingChoices = [...document.querySelectorAll('[data-oni-training]')];
  const gameModeChoices = [...document.querySelectorAll('[data-game-mode]')];

  function allClearUnlocked() {
    try { return localStorage.getItem('ningenkagu.completed') === '1'; }
    catch (e) { return false; }
  }

  function syncStartLabel() {
    if (!btnStart) return;
    if (selectedGameMode === GAME_MODE.KISHIN) {
      btnStart.textContent = '🔥 鬼神モード開始';
      return;
    }
    const selected = getForcedOniPersonality();
    const p = selected ? ONI_PERSONALITIES[selected] : null;
    btnStart.textContent = p ? `${p.icon} ${p.name}と特訓開始` : 'ゲーム開始';
  }

  function syncTrainingUi() {
    const unlocked = allClearUnlocked();
    btnTraining?.classList.toggle('hidden', !unlocked);
    if (!unlocked) setForcedOniPersonality(null);

    const selected = getForcedOniPersonality();
    for (const button of trainingChoices) {
      const id = button.dataset.oniTraining || null;
      const on = selectedGameMode === GAME_MODE.NORMAL && (id || null) === selected;
      button.classList.toggle('on', on);
      button.setAttribute('aria-pressed', String(on));
    }
    syncStartLabel();
  }

  function syncKishinUi() {
    const unlocked = allClearUnlocked();
    if (!unlocked && selectedGameMode === GAME_MODE.KISHIN) selectedGameMode = GAME_MODE.NORMAL;

    const progress = kishinProgress(STAGES.map((stage) => stage.id));
    if (btnKishin) {
      btnKishin.disabled = !unlocked;
      btnKishin.setAttribute('aria-disabled', String(!unlocked));
      btnKishin.textContent = unlocked
        ? `🔥 鬼神モード　${progress.count}/${progress.total}`
        : '🔒 鬼神モード';
      btnKishin.title = unlocked ? '3つの鬼相を1戦で乗り切る高難度モード' : 'ALL CLEARで解放';
    }
    if (kishinProgressEl) kishinProgressEl.textContent = `鬼神制覇 ${progress.count}/${progress.total}`;
    if (kishinMasterBadge) kishinMasterBadge.classList.toggle('hidden', !progress.complete);

    for (const button of gameModeChoices) {
      const on = button.dataset.gameMode === selectedGameMode;
      button.classList.toggle('on', on);
      button.setAttribute('aria-pressed', String(on));
    }
    syncStageUi();
    syncStartLabel();
    return progress;
  }

  /**
   * スタート時だけステージ専用の見やすい構図を適用する。
   * キャラもカメラ前方へ向けておき、最初の一歩が自然に攻略エリアへ入るようにする。
   */
  function applyStageStartView() {
    const cfg = STAGES[stageIndex].startView;
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
    // タイトルでモードを切り替えた場合、ステージ本体も同じモードで作り直す。
    if (game.mode !== selectedGameMode) loadStage(stageIndex);
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
    hud.toast(STAGES[stageIndex].label + (selectedGameMode === GAME_MODE.KISHIN ? '　🔥 鬼神に耐えろ！' : '　隠れろ！'));
    input.setEnabled(true);
  }

  /** 勝利かつ次のステージがあるときだけ進み、それ以外は現在の面をリトライする。 */
  function startFromCurrentScreen() {
    if (game.state === 'win' && stageIndex < STAGES.length - 1) {
      loadStage(stageIndex + 1);
    }
    beginCurrentStage();
  }

  /**
   * ポーズ中・リザルトからタイトルへ戻る。
   * 現在のステージを選択した状態で作り直し、通常の起動時と同じ画面にする。
   */
  function returnToTitle() {
    input.setEnabled(false);
    hud.hideResult();
    hud.setPaused(false);
    loadStage(stageIndex);
    titleEl.classList.remove('hidden');
    appEl.classList.add('titlemode');
    uiEl.classList.remove('playing');
    scene.background = TITLE_BG;
    syncTrainingUi();
    syncKishinUi();
  }

  bindTap(btnStart, beginCurrentStage);
  bindTap(btnRetry, startFromCurrentScreen);
  bindTap(btnPauseTitle, returnToTitle);
  bindTap(btnResultTitle, returnToTitle);
  bindTap(btnMimic, () => input.pressMimic());
  bindTap(btnPose, () => input.pressPose());
  bindTap(btnDecoy, () => input.pressDecoy());
  bindTap(btnPause, () => game.togglePause());
  bindTap(btnResume, () => game.resume());
  bindTap(btnHow, () => showCard('how'));
  bindTap(btnConfig, () => showCard('config'));
  bindTap(btnTraining, () => showCard('training'));
  bindTap(btnKishin, () => showCard('kishin'));
  for (const button of trainingChoices) {
    bindTap(button, () => {
      selectedGameMode = GAME_MODE.NORMAL;
      setForcedOniPersonality(button.dataset.oniTraining || null);
      syncTrainingUi();
      syncKishinUi();
    });
  }
  for (const button of gameModeChoices) {
    bindTap(button, () => {
      const mode = button.dataset.gameMode;
      if (mode === GAME_MODE.KISHIN && !allClearUnlocked()) return;
      selectedGameMode = mode === GAME_MODE.KISHIN ? GAME_MODE.KISHIN : GAME_MODE.NORMAL;
      if (selectedGameMode === GAME_MODE.KISHIN) setForcedOniPersonality(null);
      syncTrainingUi();
      syncKishinUi();
    });
  }
  syncTrainingUi();
  syncKishinUi();
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

  /** 0〜100 の整数として保存する。パーセント表示・スライダーの値と直接対応させる */
  function loadPercent(key, fallback, min = 0, max = 100) {
    let raw = null;
    try {
      raw = localStorage.getItem(key);
    } catch (e) { /* noop */ }
    return normalizeSettingNumber(raw, { min, max, fallback });
  }
  function savePercent(key, v) {
    try { localStorage.setItem(key, String(v)); } catch (e) { /* noop */ }
  }

  function applyBgmVolume(pct, { persist = true } = {}) {
    setBgmVolume(pct / 100);
    if (rangeBgmVolume) rangeBgmVolume.value = String(pct);
    if (bgmVolumeVal) bgmVolumeVal.textContent = pct + '%';
    if (persist) savePercent(BGM_VOLUME_KEY, pct);
  }
  function applySfxVolume(pct, { persist = true } = {}) {
    setSfxVolume(pct / 100);
    if (rangeSfxVolume) rangeSfxVolume.value = String(pct);
    if (sfxVolumeVal) sfxVolumeVal.textContent = pct + '%';
    if (persist) savePercent(SFX_VOLUME_KEY, pct);
  }
  function applySensitivity(pct, { persist = true } = {}) {
    input.lookSensitivity = pct / 100;
    if (rangeSensitivity) rangeSensitivity.value = String(pct);
    if (sensitivityVal) sensitivityVal.textContent = pct + '%';
    if (persist) savePercent(SENSITIVITY_KEY, pct);
  }
  function applyInvertY(on, { persist = true } = {}) {
    input.invertY = on;
    if (btnInvertY) {
      btnInvertY.textContent = on ? 'オン' : 'オフ';
      btnInvertY.classList.toggle('on', on);
      btnInvertY.setAttribute('aria-pressed', String(on));
    }
    if (persist) { try { localStorage.setItem(INVERT_Y_KEY, on ? '1' : '0'); } catch (e) { /* noop */ } }
  }

  applyBgmVolume(loadPercent(BGM_VOLUME_KEY, 100), { persist: false });
  applySfxVolume(loadPercent(SFX_VOLUME_KEY, 100), { persist: false });
  applySensitivity(loadPercent(SENSITIVITY_KEY, 100, 50, 200), { persist: false });
  let savedInvertY = false;
  try { savedInvertY = localStorage.getItem(INVERT_Y_KEY) === '1'; } catch (e) { /* noop */ }
  applyInvertY(savedInvertY, { persist: false });

  if (rangeBgmVolume) rangeBgmVolume.addEventListener('input', () => applyBgmVolume(Number(rangeBgmVolume.value)));
  if (rangeSfxVolume) rangeSfxVolume.addEventListener('input', () => applySfxVolume(Number(rangeSfxVolume.value)));
  if (rangeSensitivity) rangeSensitivity.addEventListener('input', () => applySensitivity(Number(rangeSensitivity.value)));
  bindTap(btnInvertY, () => applyInvertY(!input.invertY));

  // ゲームパッドの接続状態を設定カードに出す（接続すれば自動で使えるので、ここは状態表示のみ）
  function syncGamepadStatus() {
    if (!gamepadStatus) return;
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const connected = pads && [...pads].some((p) => p && p.connected !== false);
    gamepadStatus.textContent = connected ? '接続済み' : '未接続';
    gamepadStatus.classList.toggle('on', connected);
  }
  window.addEventListener('gamepadconnected', syncGamepadStatus);
  window.addEventListener('gamepaddisconnected', syncGamepadStatus);
  syncGamepadStatus();

  // ここまで来ればボタン・状態の配線が全て終わっている。読み込み中の案内を消し、
  // タイトルの静的HTMLだけが先に触れてしまう状態を終わらせる。
  hideLoading();

  hud.onResultChange = (shown) => {
    if (shown) {
      input.setEnabled(false);
      uiEl.classList.remove('playing');
      const hasNext = game.state === 'win' && stageIndex < STAGES.length - 1;
      const kishinWin = game.state === 'win' && game.mode === GAME_MODE.KISHIN;
      let kishinState = null;

      if (kishinWin) {
        saveKishinClear(STAGES[stageIndex].id);
        kishinState = syncKishinUi();
        syncStageUi();
        const resultTitle = document.getElementById('resultTitle');
        if (resultTitle) {
          resultTitle.textContent = kishinState.complete ? 'KISHIN MASTER!' : '鬼神 CLEAR!';
          resultTitle.className = 'win';
        }
      }

      // クリアした時点で次の面を解放する。
      // 「次のステージへ」を押さずタイトルへ戻っても、進行が失われないようにする。
      if (hasNext) {
        unlockedMax = Math.max(unlockedMax, stageIndex + 1);
        saveStageIndex(unlockedMax);
        syncStageUi();
      }
      syncTrainingUi();
      syncKishinUi();

      if (btnRetry) {
        btnRetry.textContent = hasNext
          ? '次のステージへ'
          : (stageIndex === STAGES.length - 1 && game.state === 'win' ? STAGES[stageIndex].name + 'をもう一度' : 'もう一度遊ぶ');
      }

      if (kishinWin && resultNote && kishinState) {
        resultNote.textContent = kishinState.complete
          ? '🔥👑 全5ステージ鬼神制覇。KISHIN MASTER 達成！'
          : `🔥 鬼神制覇 ${kishinState.count}/${kishinState.total}。次の部屋でも三相変化を耐え抜け。`;
      } else if (hasNext && resultNote) {
        resultNote.textContent = STAGES[stageIndex].clearNote;
      }
    }
  };

  // タイトル・リザルトはキーボードだけでも進められるようにする
  window.addEventListener('keydown', (e) => {
    if (input.enabled || e.repeat) return;
    if (e.code !== 'Enter' && e.code !== 'Space') return;
    if (document.activeElement && document.activeElement.tagName === 'BUTTON') return;
    // あそびかた / 設定を開いている間は誤爆させない（ゲームパッドの確認ボタンと同じ扱い）
    if (document.documentElement.classList.contains('title-card-open')) return;
    e.preventDefault();
    startFromCurrentScreen();
  });

  // スクロール・ピンチズームの抑止。
  // タイトルの「あそびかた / 設定」カードと、タイトル / ポーズ / リザルトの
  // オーバーレイ（.screen）内はネイティブの縦スクロールに任せる。
  // 横持ちスマホではリザルトのパネルが1画面に収まらないことがあり、
  // ここまで止めてしまうと下のボタンへ指が届かなくなる。
  // （そちらは css/style.css 側で touch-action: pan-y を許可している）
  document.addEventListener('touchmove', (e) => {
    if (e.target.closest('.tcard, .screen')) return;
    e.preventDefault();
  }, { passive: false });
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
      // タイトル・リザルトはゲームパッドの確認ボタン（擬態と同じボタン）でも進める。
      // カードを開いている間は誤操作防止のため無視する（あそびかた/設定を見ている最中に暴発しないように）。
      if (!input.enabled && input.consumeConfirm()
        && !document.documentElement.classList.contains('title-card-open')) {
        startFromCurrentScreen();
      }
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
    getGameMode: () => selectedGameMode,
    setGameMode: (mode) => {
      selectedGameMode = mode === GAME_MODE.KISHIN && allClearUnlocked() ? GAME_MODE.KISHIN : GAME_MODE.NORMAL;
      if (selectedGameMode === GAME_MODE.KISHIN) setForcedOniPersonality(null);
      syncTrainingUi();
      syncKishinUi();
      return selectedGameMode;
    },
    // ステージイベントの状態は __ningenkagu.game.stageEvent で見られる
    stageEvents: STAGE_EVENTS,
    // 現在ステージのイベントを強制発生させる（プレイ中のみ・通常UIには出さない）
    triggerStageEvent: () => game.stageEvent.forceStart(),
    stageEventInfo: () => game.stageEvent.info,
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
