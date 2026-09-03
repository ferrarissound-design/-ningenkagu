// タイトル画面の「あそびかた / 設定 / 特訓 / 家具図鑑」をスマホでも快適に扱う。
// 開閉に応じたレイアウト（全画面前面表示・タッチスクロール許可）は
// css/style.css の html.title-card-open 系ルールが担当する。
// ここでは開閉状態をそのクラスへ反映することと、既存カードの閉じるボタン追加を行う。

const btnHow = document.getElementById('btnHow');
const btnConfig = document.getElementById('btnConfig');
const btnTraining = document.getElementById('btnTraining');
const btnCatalog = document.getElementById('btnCatalog');
const cardHow = document.getElementById('cardHow');
const cardConfig = document.getElementById('cardConfig');
const cardTraining = document.getElementById('cardTraining');
const catalogOverlay = document.getElementById('catalogOverlay');

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
addCloseButton(cardTraining, btnTraining);

function isOpen() {
  return btnHow?.getAttribute('aria-expanded') === 'true'
    || btnConfig?.getAttribute('aria-expanded') === 'true'
    || btnTraining?.getAttribute('aria-expanded') === 'true'
    || btnCatalog?.getAttribute('aria-expanded') === 'true';
}

function syncOpenState() {
  const open = isOpen();
  document.documentElement.classList.toggle('title-card-open', open);
  if (open) {
    const active = btnHow?.getAttribute('aria-expanded') === 'true'
      ? cardHow
      : (btnConfig?.getAttribute('aria-expanded') === 'true'
        ? cardConfig
        : (btnTraining?.getAttribute('aria-expanded') === 'true' ? cardTraining : catalogOverlay));
    if (active) active.scrollTop = 0;
  }
}

if (btnHow && btnConfig) {
  const observer = new MutationObserver(syncOpenState);
  observer.observe(btnHow, { attributes: true, attributeFilter: ['aria-expanded'] });
  observer.observe(btnConfig, { attributes: true, attributeFilter: ['aria-expanded'] });
  if (btnTraining) observer.observe(btnTraining, { attributes: true, attributeFilter: ['aria-expanded'] });
  if (btnCatalog) observer.observe(btnCatalog, { attributes: true, attributeFilter: ['aria-expanded'] });
  syncOpenState();
}
