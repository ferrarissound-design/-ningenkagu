// タイトル画面の「あそびかた / 設定」をスマホでも快適に扱う。
// ゲーム全体は誤スクロール防止のまま、カードが開いている間だけ縦スワイプを許可する。

const btnHow = document.getElementById('btnHow');
const btnConfig = document.getElementById('btnConfig');
const side = document.querySelector('#title .tl-side');
const cardHow = document.getElementById('cardHow');
const cardConfig = document.getElementById('cardConfig');

const style = document.createElement('style');
style.textContent = `
  .titleCardClose {
    position: sticky;
    top: 0;
    z-index: 20;
    display: block;
    margin: -4px 0 8px auto;
    border: 1px solid rgba(61,255,110,.7);
    background: rgba(8,12,10,.96);
    color: #dfffe8;
    border-radius: 999px;
    padding: 7px 12px;
    font: 700 12px/1 system-ui, -apple-system, sans-serif;
    letter-spacing: .04em;
    -webkit-appearance: none;
    appearance: none;
    touch-action: manipulation !important;
  }

  html.title-card-open,
  html.title-card-open body,
  html.title-card-open #app,
  html.title-card-open #title,
  html.title-card-open #title .tl-side,
  html.title-card-open #title .tcard {
    touch-action: pan-y !important;
  }

  @media (max-width: 860px) {
    html.title-card-open #title .tl-side {
      display: block !important;
      position: absolute !important;
      left: calc(env(safe-area-inset-left, 0px) + 12px) !important;
      right: calc(env(safe-area-inset-right, 0px) + 12px) !important;
      top: calc(env(safe-area-inset-top, 0px) + 118px) !important;
      bottom: calc(env(safe-area-inset-bottom, 0px) + 68px) !important;
      width: auto !important;
      z-index: 40 !important;
      overflow: hidden !important;
      padding: 0 !important;
    }

    html.title-card-open #title .tcard:not(.hidden) {
      display: block !important;
      height: 100% !important;
      max-height: none !important;
      overflow-x: hidden !important;
      overflow-y: auto !important;
      -webkit-overflow-scrolling: touch !important;
      overscroll-behavior-y: contain !important;
      background: rgba(8,12,10,.96) !important;
      box-shadow: 0 12px 40px rgba(0,0,0,.78), inset 0 0 24px rgba(61,255,110,.06) !important;
      padding-bottom: 24px !important;
    }
  }

  @media (max-width: 860px) and (orientation: landscape) {
    html.title-card-open #title .tl-side {
      left: auto !important;
      right: calc(env(safe-area-inset-right, 0px) + 12px) !important;
      top: calc(env(safe-area-inset-top, 0px) + 38px) !important;
      bottom: calc(env(safe-area-inset-bottom, 0px) + 54px) !important;
      width: min(54vw, 440px) !important;
    }
  }
`;
document.head.appendChild(style);

function addCloseButton(card, opener) {
  if (!card || !opener || card.querySelector('.titleCardClose')) return;
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'titleCardClose';
  close.textContent = '✕ 閉じる';
  close.setAttribute('aria-label', '閉じる');
  close.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (opener.getAttribute('aria-expanded') === 'true') opener.click();
  });
  card.prepend(close);
}

addCloseButton(cardHow, btnHow);
addCloseButton(cardConfig, btnConfig);

function isOpen() {
  return btnHow?.getAttribute('aria-expanded') === 'true'
    || btnConfig?.getAttribute('aria-expanded') === 'true';
}

function syncOpenState() {
  const open = isOpen();
  document.documentElement.classList.toggle('title-card-open', open);
  if (open) {
    const active = btnHow?.getAttribute('aria-expanded') === 'true' ? cardHow : cardConfig;
    if (active) active.scrollTop = 0;
  }
}

if (btnHow && btnConfig) {
  const observer = new MutationObserver(syncOpenState);
  observer.observe(btnHow, { attributes: true, attributeFilter: ['aria-expanded'] });
  observer.observe(btnConfig, { attributes: true, attributeFilter: ['aria-expanded'] });
  syncOpenState();
}

// main.js の document touchmove 防止より手前で止めて、カードのネイティブスクロールを守る。
if (side) {
  side.addEventListener('touchmove', (event) => {
    if (isOpen() && event.target.closest('.tcard')) event.stopPropagation();
  }, { passive: true });
}
