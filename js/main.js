// エントリポイント：レンダラ・ライト・ゲームループ・UI配線
import * as THREE from '../vendor/three/three.module.min.js';
import { Game } from './game.js';
import { Hud } from './hud.js';
import { Input } from './input.js';
import { initAudio, setMuted, isMuted } from './audio.js';

const MUTE_KEY = 'ningenkagu.muted';

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

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x14161c);
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
  const game = new Game(scene, camera, hud);

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

  // ---- UI 配線 ----
  const titleEl = document.getElementById('title');
  const uiEl = document.getElementById('ui');
  const btnStart = document.getElementById('btnStart');
  const btnRetry = document.getElementById('btnRetry');
  const btnResume = document.getElementById('btnResume');
  const btnMimic = document.getElementById('btnMimic');
  const btnPose = document.getElementById('btnPose');
  const btnPause = document.getElementById('pauseBtn');
  const muteBtn = document.getElementById('muteBtn');

  function bindTap(el, fn) {
    if (!el) return;
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      el.classList.add('active');
      fn();
    });
    // Enter・Space・支援技術による通常の button click にも対応する。
    // ポインター由来の click は pointerdown で処理済みなので重複させない。
    el.addEventListener('click', (e) => {
      if (e.detail !== 0) return;
      e.preventDefault();
      fn();
    });
    const clear = () => el.classList.remove('active');
    el.addEventListener('pointerup', clear);
    el.addEventListener('pointercancel', clear);
    el.addEventListener('pointerleave', clear);
  }

  function startGame() {
    initAudio();
    hud.resetVisuals();
    hud.hideResult();
    titleEl.classList.add('hidden');
    uiEl.classList.add('playing');
    game.start();
    input.setEnabled(true);
  }

  bindTap(btnStart, startGame);
  bindTap(btnRetry, startGame);
  bindTap(btnMimic, () => input.pressMimic());
  bindTap(btnPose, () => input.pressPose());
  bindTap(btnPause, () => game.togglePause());
  bindTap(btnResume, () => game.resume());
  bindTap(muteBtn, () => {
    initAudio();
    applyMuted(!isMuted());
  });

  function applyMuted(m) {
    setMuted(m);
    muteBtn.textContent = m ? '🔇' : '🔊';
    muteBtn.setAttribute('aria-pressed', String(m));
    try { localStorage.setItem(MUTE_KEY, m ? '1' : '0'); } catch (e) { /* 保存できなくても続行 */ }
  }

  let savedMute = false;
  try { savedMute = localStorage.getItem(MUTE_KEY) === '1'; } catch (e) { /* noop */ }
  applyMuted(savedMute);

  hud.onResultChange = (shown) => {
    if (shown) {
      input.setEnabled(false);
      uiEl.classList.remove('playing');
    }
  };

  // タイトル・リザルトはキーボードだけでも進められるようにする
  window.addEventListener('keydown', (e) => {
    if (input.enabled || e.repeat) return;
    if (e.code !== 'Enter' && e.code !== 'Space') return;
    // ボタンにフォーカスがある場合は、ブラウザ標準の click に任せる
    if (document.activeElement && document.activeElement.tagName === 'BUTTON') return;
    e.preventDefault();
    startGame();
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

  // デバッグ用に少しだけ公開
  window.__ningenkagu = { game, input, hud, renderer, THREE };
}

const canvas = document.getElementById('scene');
const renderer = createRenderer(canvas);
if (renderer) {
  boot(renderer);
} else {
  showFatal('このブラウザ・端末では WebGL を利用できないため、ゲームを表示できませんでした。別のブラウザでお試しください。');
}
