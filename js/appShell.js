// ゲーム本体とは独立した「ページの器」側の仕上げ。
// 保存データ初期化、ダイアログのフォーカス管理、Service Worker 登録をまとめる。
import { clearProgressData } from './saveData.js';

function installProgressReset() {
  const card = document.getElementById('cardConfig');
  if (!card || document.getElementById('btnResetProgress')) return;

  const row = document.createElement('div');
  row.className = 'trow';

  const label = document.createElement('span');
  label.textContent = '進行データ';

  const button = document.createElement('button');
  button.id = 'btnResetProgress';
  button.className = 'chipbtn';
  button.type = 'button';
  button.textContent = '初期化';
  button.setAttribute('aria-label', 'ベストスコア、ランク、ミッション、鬼攻略、ステージ進行を初期化');

  row.append(label, button);

  const note = document.createElement('p');
  note.className = 'tcard-p';
  note.textContent = '初期化してもサウンド・音量・視点感度・Y軸反転の設定は残ります。';

  card.append(row, note);

  button.addEventListener('click', () => {
    const ok = window.confirm('ベストスコア、ランク、ミッション、鬼攻略、ステージ進行を初期化しますか？\n設定は残ります。');
    if (!ok) return;

    clearProgressData();
    button.disabled = true;
    button.textContent = '初期化済み';
    // 各モジュールが持つ表示キャッシュも確実に初期化するため、ページを作り直す。
    window.setTimeout(() => window.location.reload(), 120);
  });
}

function focusableElements(dialog) {
  return [...dialog.querySelectorAll(
    'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )].filter((el) => !el.hidden && el.getClientRects().length > 0);
}

/** ポーズ・リザルト・致命エラーを本物のモーダルとして読み上げ、フォーカスも中へ移す。 */
function installDialogA11y(id, preferredFocusId) {
  const dialog = document.getElementById(id);
  if (!dialog) return;

  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');

  const heading = dialog.querySelector('h1, h2, h3');
  if (heading) {
    if (!heading.id) heading.id = `${id}DialogTitle`;
    dialog.setAttribute('aria-labelledby', heading.id);
  }

  let open = !dialog.classList.contains('hidden');
  let returnFocus = null;

  function sync() {
    const nextOpen = !dialog.classList.contains('hidden');
    if (nextOpen === open) return;
    open = nextOpen;

    if (open) {
      returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      window.requestAnimationFrame(() => {
        const preferred = preferredFocusId ? document.getElementById(preferredFocusId) : null;
        const target = preferred && !preferred.disabled ? preferred : focusableElements(dialog)[0];
        target?.focus({ preventScroll: true });
      });
    } else if (returnFocus?.isConnected) {
      returnFocus.focus({ preventScroll: true });
      returnFocus = null;
    }
  }

  const observer = new MutationObserver(sync);
  observer.observe(dialog, { attributes: true, attributeFilter: ['class'] });

  dialog.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab' || !open) return;
    const items = focusableElements(dialog);
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
}

/**
 * 起動失敗ダイアログの「再読み込み」。
 * #fatal は role=dialog / aria-modal=true を名乗るので、押せる要素が1つも無いと
 * フォーカスが背後に取り残され、案内文どおりの再読み込みも自力ではできなくなる。
 */
function installFatalReload() {
  const button = document.getElementById('btnFatalReload');
  if (!button) return;
  button.addEventListener('click', () => window.location.reload());
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((error) => {
      // オフライン対応に失敗してもゲーム本体はそのまま遊べる。
      console.warn('Service Worker registration failed:', error);
    });
  }, { once: true });
}

installProgressReset();
installFatalReload();
installDialogA11y('pause', 'btnResume');
installDialogA11y('result', 'btnRetry');
installDialogA11y('fatal', 'btnFatalReload');
registerServiceWorker();
