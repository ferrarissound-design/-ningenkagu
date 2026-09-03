// 初回起動時だけ流れる、約10秒の超短いオープニング。
// ゲーム本体の状態には触れず、タイトル画面の上へ一時的な演出レイヤを重ねる。

export const OPENING_SEEN_KEY = 'ningenkagu.openingSeen.v1';

export const OPENING_CUES = Object.freeze([
  { text: 'ある日、カグミンは気づいた。', hold: 2100, kind: 'story' },
  { text: '人間のフリをするより……', hold: 1900, kind: 'story' },
  { text: '家具のフリをした方が安全だった。', hold: 2300, kind: 'story strong' },
  { text: '……みつけた', hold: 1700, kind: 'eye' },
  { text: 'ニンゲン家具', hold: 1500, kind: 'title' },
]);

export function hasSeenOpening(storage = globalThis.localStorage) {
  try {
    return storage?.getItem(OPENING_SEEN_KEY) === '1';
  } catch (error) {
    return false;
  }
}

export function markOpeningSeen(storage = globalThis.localStorage) {
  try {
    storage?.setItem(OPENING_SEEN_KEY, '1');
    return true;
  } catch (error) {
    return false;
  }
}

export function clearOpeningSeen(storage = globalThis.localStorage) {
  try {
    storage?.removeItem(OPENING_SEEN_KEY);
    return true;
  } catch (error) {
    return false;
  }
}

export function cueDuration(cue, reducedMotion = false) {
  if (!cue) return 0;
  if (!reducedMotion) return cue.hold;
  // 「視差・大きな動き」を減らしたい利用者にはテンポも短くし、長時間拘束しない。
  return Math.min(650, cue.hold);
}

const STYLE_ID = 'ningenkagu-opening-style';
let currentOverlay = null;
let cueTimer = 0;
let removeTimer = 0;
let active = false;
let onKeyDown = null;

function installStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    #openingIntro {
      position: fixed;
      inset: 0;
      z-index: 10000;
      display: grid;
      place-items: center;
      overflow: hidden;
      background: #05070b;
      color: #f7f8fb;
      font-family: inherit;
      pointer-events: none;
      opacity: 1;
      transition: opacity 360ms ease;
      isolation: isolate;
    }
    #openingIntro::before {
      content: '';
      position: absolute;
      inset: -12%;
      z-index: -1;
      background:
        radial-gradient(circle at 50% 42%, rgba(84, 102, 140, .18), transparent 34%),
        radial-gradient(circle at 50% 100%, rgba(255, 138, 43, .08), transparent 40%);
      animation: nkOpeningBreath 5.5s ease-in-out infinite alternate;
    }
    #openingIntro.closing { opacity: 0; }
    .nk-opening-copy {
      position: absolute;
      width: min(82vw, 760px);
      margin: 0;
      padding: 0 18px;
      text-align: center;
      font-size: clamp(19px, 4.8vw, 36px);
      font-weight: 700;
      letter-spacing: .08em;
      line-height: 1.7;
      text-wrap: balance;
      opacity: 0;
      transform: translateY(8px) scale(.99);
      filter: blur(4px);
      transition: opacity 420ms ease, transform 620ms ease, filter 420ms ease;
      text-shadow: 0 2px 18px rgba(0, 0, 0, .75);
    }
    .nk-opening-copy.show {
      opacity: 1;
      transform: translateY(0) scale(1);
      filter: blur(0);
    }
    .nk-opening-copy.strong { color: #ffe27a; }
    .nk-opening-copy.eye {
      color: #ff687c;
      font-size: clamp(18px, 4.6vw, 32px);
      letter-spacing: .18em;
    }
    .nk-opening-copy.eye::before {
      content: '👁';
      display: block;
      margin-bottom: 12px;
      font-size: clamp(46px, 13vw, 92px);
      line-height: 1;
      filter: drop-shadow(0 0 18px rgba(255, 61, 96, .45));
      animation: nkOpeningEye 1.2s ease-in-out infinite alternate;
    }
    .nk-opening-copy.title {
      color: #fff;
      font-size: clamp(32px, 9vw, 72px);
      font-weight: 900;
      letter-spacing: .14em;
      text-shadow:
        0 0 14px rgba(34, 224, 255, .32),
        0 0 30px rgba(255, 61, 139, .22);
    }
    .nk-opening-skip {
      position: absolute;
      top: max(14px, env(safe-area-inset-top));
      right: max(14px, env(safe-area-inset-right));
      z-index: 2;
      pointer-events: auto;
      border: 1px solid rgba(255,255,255,.32);
      border-radius: 999px;
      padding: 9px 14px;
      background: rgba(10, 12, 18, .56);
      color: rgba(255,255,255,.82);
      font: inherit;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: .08em;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
      backdrop-filter: blur(8px);
    }
    .nk-opening-skip:hover,
    .nk-opening-skip:focus-visible {
      color: #fff;
      border-color: rgba(255,255,255,.72);
      outline: none;
    }
    .nk-opening-hint {
      position: absolute;
      bottom: max(14px, env(safe-area-inset-bottom));
      left: 50%;
      transform: translateX(-50%);
      margin: 0;
      color: rgba(255,255,255,.38);
      font-size: 10px;
      letter-spacing: .12em;
      white-space: nowrap;
    }
    @keyframes nkOpeningBreath {
      from { transform: scale(1); opacity: .72; }
      to { transform: scale(1.06); opacity: 1; }
    }
    @keyframes nkOpeningEye {
      from { transform: scale(.96); opacity: .78; }
      to { transform: scale(1.04); opacity: 1; }
    }
    @media (prefers-reduced-motion: reduce) {
      #openingIntro::before,
      .nk-opening-copy.eye::before { animation: none; }
      .nk-opening-copy,
      #openingIntro { transition-duration: 80ms; }
      .nk-opening-copy { transform: none; filter: none; }
    }
  `;
  document.head.appendChild(style);
}

function clearTimers() {
  if (cueTimer) window.clearTimeout(cueTimer);
  if (removeTimer) window.clearTimeout(removeTimer);
  cueTimer = 0;
  removeTimer = 0;
}

function detachKeyHandler() {
  if (onKeyDown) document.removeEventListener('keydown', onKeyDown);
  onKeyDown = null;
}

function finishOpening({ remember = true, immediate = false } = {}) {
  if (!currentOverlay) return;
  if (remember) markOpeningSeen();

  active = false;
  clearTimers();
  detachKeyHandler();
  currentOverlay.classList.add('closing');
  const doomed = currentOverlay;
  currentOverlay = null;

  removeTimer = window.setTimeout(() => {
    doomed.remove();
    removeTimer = 0;
  }, immediate ? 0 : 380);
}

export function playOpening({ force = false } = {}) {
  if (typeof document === 'undefined' || typeof window === 'undefined') return false;
  if (!force && hasSeenOpening()) return false;

  if (currentOverlay) finishOpening({ remember: false, immediate: true });
  installStyle();

  const overlay = document.createElement('section');
  overlay.id = 'openingIntro';
  overlay.setAttribute('aria-label', 'ニンゲン家具 オープニング');
  overlay.setAttribute('aria-live', 'polite');

  const copy = document.createElement('p');
  copy.className = 'nk-opening-copy';

  const skip = document.createElement('button');
  skip.className = 'nk-opening-skip';
  skip.type = 'button';
  skip.textContent = 'SKIP';
  skip.setAttribute('aria-label', 'オープニングをスキップ');

  const hint = document.createElement('p');
  hint.className = 'nk-opening-hint';
  hint.textContent = 'ESC でもスキップ';
  hint.setAttribute('aria-hidden', 'true');

  overlay.append(copy, skip, hint);
  document.body.appendChild(overlay);
  currentOverlay = overlay;
  active = true;

  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  let cueIndex = 0;

  function showCue(index) {
    if (!currentOverlay || currentOverlay !== overlay) return;
    const cue = OPENING_CUES[index];
    if (!cue) {
      finishOpening();
      return;
    }

    copy.className = `nk-opening-copy ${cue.kind}`;
    copy.textContent = cue.text;
    // classを付け直すフレームを分け、同じ要素でもフェードインを確実に再生する。
    requestAnimationFrame(() => {
      if (currentOverlay === overlay) copy.classList.add('show');
    });

    const duration = cueDuration(cue, reducedMotion);
    cueTimer = window.setTimeout(() => {
      copy.classList.remove('show');
      cueTimer = window.setTimeout(() => {
        cueIndex += 1;
        showCue(cueIndex);
      }, reducedMotion ? 90 : 260);
    }, Math.max(120, duration - (reducedMotion ? 80 : 280)));
  }

  skip.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    finishOpening();
  });

  onKeyDown = (event) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    finishOpening();
  };
  document.addEventListener('keydown', onKeyDown);

  showCue(0);
  return true;
}

export function replayOpening() {
  return playOpening({ force: true });
}

export function skipOpening() {
  finishOpening();
}

export function isOpeningActive() {
  return active;
}

function bootOpening() {
  playOpening();
  window.__ningenkaguOpening = {
    play: playOpening,
    replay: replayOpening,
    skip: skipOpening,
    reset: () => clearOpeningSeen(),
    isActive: isOpeningActive,
    seenKey: OPENING_SEEN_KEY,
  };
}

if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootOpening, { once: true });
  } else {
    bootOpening();
  }
}
