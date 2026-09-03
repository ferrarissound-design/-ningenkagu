// ゲーム本体とは独立した「ページの器」側の仕上げ。
// 保存データ初期化、ダイアログのフォーカス管理、Service Worker 登録をまとめる。
import { clearProgressData } from './saveData.js';
import { buildSaveFile, parseSaveFile, applySaveEntries } from './saveTransfer.js';

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

function downloadFileName() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `ningenkagu-save-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}.json`;
}

/**
 * localStorage はブラウザ・端末ごとに独立しているため、機種変更や
 * ブラウザの初期化で進行データがすべて消える。ファイル1つに書き出し／
 * 読み込みできるようにして、バックアップや別端末への移行に使えるようにする。
 */
function installSaveTransfer() {
  const card = document.getElementById('cardConfig');
  if (!card || document.getElementById('btnExportSave')) return;

  const row = document.createElement('div');
  row.className = 'trow';

  const label = document.createElement('span');
  label.textContent = 'セーブデータ';

  const buttons = document.createElement('span');
  buttons.style.display = 'flex';
  buttons.style.gap = '6px';

  const exportBtn = document.createElement('button');
  exportBtn.id = 'btnExportSave';
  exportBtn.className = 'chipbtn';
  exportBtn.type = 'button';
  exportBtn.textContent = '書き出す';
  exportBtn.setAttribute('aria-label', '進行データと設定をファイルへ書き出す');

  const importBtn = document.createElement('button');
  importBtn.id = 'btnImportSave';
  importBtn.className = 'chipbtn';
  importBtn.type = 'button';
  importBtn.textContent = '読み込む';
  importBtn.setAttribute('aria-label', 'ファイルから進行データと設定を読み込む');

  const fileInput = document.createElement('input');
  fileInput.id = 'inputImportSave';
  fileInput.type = 'file';
  fileInput.accept = 'application/json,.json';
  fileInput.hidden = true;

  buttons.append(exportBtn, importBtn);
  row.append(label, buttons);

  const note = document.createElement('p');
  note.className = 'tcard-p';
  note.textContent = 'ベストスコア・ランク・ミッション・鬼攻略・音量などの設定を1つのファイルにまとめて書き出せます。別のブラウザや端末へ移すときや、初期化前のバックアップに使えます。';

  card.append(row, fileInput, note);

  exportBtn.addEventListener('click', () => {
    const file = buildSaveFile();
    const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = downloadFileName();
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  importBtn.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (!file) return;

    let text;
    try {
      text = await file.text();
    } catch {
      window.alert('ファイルを読み込めませんでした。');
      return;
    }

    const result = parseSaveFile(text);
    if (!result.ok) {
      window.alert('このファイルは読み込めませんでした。ニンゲン家具のセーブデータファイルを選んでください。');
      return;
    }

    const ok = window.confirm(`${result.entries.length}件のデータを読み込みます。現在のベストスコア・ランク・進行状況・設定は上書きされます。よろしいですか？`);
    if (!ok) return;

    try {
      applySaveEntries(result.entries);
      window.alert('読み込みました。');
      window.location.reload();
    } catch {
      window.alert('保存領域へ書き込めず、読み込みを完了できませんでした。ページを再読み込みして状態を確認してください。');
    }
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
installSaveTransfer();
installFatalReload();
installDialogA11y('pause', 'btnResume');
installDialogA11y('result', 'btnRetry');
installDialogA11y('fatal', 'btnFatalReload');
registerServiceWorker();
