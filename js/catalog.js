// 家具図鑑。
// 「クリアしたか」だけでなく「何になって遊んだか」を残し、探索そのものをリプレイ動機にする。
import { FURNITURE_KINDS } from './furnitureKinds.js';
import {
  CATALOG_NAMES,
  catalogEntries,
  catalogProgress,
  discoverFurniture,
} from './catalogData.js';
import { GAME_EVENT, onGameEvent } from './gameEvents.js';

const POSE_NAMES = Object.freeze({
  stand: '直立',
  tpose: 'Tポーズ',
  ypose: 'Yポーズ',
  crouch: 'しゃがみ',
});

const CATALOG_EVENT = 'ningenkagu:catalog-change';

let mimicDiscoveryInstalled = false;

function installMimicDiscovery() {
  if (mimicDiscoveryInstalled) return;
  mimicDiscoveryInstalled = true;

  onGameEvent(GAME_EVENT.MIMIC, ({ game, target }) => {
    if (!game || !target || !FURNITURE_KINDS[target.kind]) return;

    const progress = discoverFurniture(target.kind);
    if (!progress.newlyDiscovered) return;

    const icon = FURNITURE_KINDS[target.kind].icon || '🪑';
    const name = CATALOG_NAMES[target.kind] || target.label || target.kind;
    if (progress.complete) {
      game.hud.popup('👑 家具図鑑 COMPLETE！ 家具博士！', 'good big');
    } else {
      game.hud.popup(`NEW! 図鑑登録 ${icon} ${name}　${progress.count}/${progress.total}`, 'good big');
    }

    window.dispatchEvent(new CustomEvent(CATALOG_EVENT, {
      detail: { ...progress, kind: target.kind },
    }));
  });
}

function installStyles() {
  if (document.getElementById('catalogStyles')) return;
  const style = document.createElement('style');
  style.id = 'catalogStyles';
  style.textContent = `
    .catalogOverlay {
      position: absolute;
      inset: 0;
      z-index: 40;
      overflow-y: auto;
      overscroll-behavior: contain;
      touch-action: pan-y;
      background: rgba(11, 13, 20, .92);
      padding: max(18px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(24px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left));
    }
    .catalogOverlay.hidden { display: none; }
    .catalogPanel {
      width: min(920px, 100%);
      margin: 0 auto;
      border-radius: 22px;
      background: rgba(25, 29, 40, .97);
      border: 1px solid rgba(255,255,255,.15);
      box-shadow: 0 22px 70px rgba(0,0,0,.45);
      padding: clamp(18px, 3vw, 30px);
      color: #fff;
    }
    .catalogHead {
      display: flex;
      gap: 14px;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 14px;
    }
    .catalogHead h2 { margin: 0; font-size: clamp(24px, 5vw, 38px); line-height: 1; }
    .catalogHead h2 small { display: block; margin-top: 7px; font-size: 11px; letter-spacing: .18em; opacity: .55; }
    .catalogClose {
      flex: 0 0 auto;
      border: 1px solid rgba(255,255,255,.22);
      border-radius: 999px;
      background: rgba(255,255,255,.08);
      color: #fff;
      min-height: 42px;
      padding: 0 16px;
      font: inherit;
      font-weight: 800;
    }
    .catalogLead { margin: 0 0 16px; opacity: .82; line-height: 1.65; }
    .catalogProgressRow { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; }
    .catalogProgressTrack { flex: 1; height: 11px; border-radius: 999px; background: rgba(255,255,255,.11); overflow: hidden; }
    .catalogProgressFill { height: 100%; width: 0; border-radius: inherit; background: linear-gradient(90deg, #22e0ff, #5cff7a, #ffd21e); transition: width .25s ease; }
    .catalogProgressText { min-width: 62px; text-align: right; font-weight: 900; font-variant-numeric: tabular-nums; }
    .catalogBadge { margin: 0 0 18px; padding: 12px 14px; border-radius: 14px; background: rgba(255,210,30,.14); border: 1px solid rgba(255,210,30,.35); font-weight: 900; text-align: center; }
    .catalogBadge.hidden { display: none; }
    .catalogGrid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 10px; }
    .catalogEntry { min-height: 132px; border-radius: 16px; border: 1px solid rgba(255,255,255,.12); background: rgba(255,255,255,.055); padding: 14px; }
    .catalogEntry.locked { display: grid; place-content: center; text-align: center; opacity: .5; border-style: dashed; }
    .catalogEntryIcon { font-size: 30px; line-height: 1; margin-bottom: 8px; }
    .catalogEntry h3 { margin: 0 0 5px; font-size: 17px; }
    .catalogEntry .catalogTrait { margin: 0 0 7px; font-size: 12px; font-weight: 800; opacity: .72; }
    .catalogEntry .catalogDesc { margin: 0; font-size: 12px; line-height: 1.5; opacity: .78; }
    .catalogEntry.locked .catalogEntryIcon { filter: grayscale(1); }
    .catalogEntry.locked p { margin: 5px 0 0; font-size: 11px; opacity: .8; }
    @media (max-width: 560px) {
      .catalogGrid { grid-template-columns: 1fr 1fr; }
      .catalogEntry { min-height: 120px; padding: 12px; }
      .catalogEntry .catalogDesc { display: none; }
    }
    @media (max-width: 370px) {
      .catalogGrid { grid-template-columns: 1fr; }
    }
  `;
  document.head.appendChild(style);
}

function installCatalogUi() {
  const title = document.getElementById('title');
  const menu = title?.querySelector('.menu');
  if (!title || !menu || document.getElementById('btnCatalog')) return;

  installStyles();

  const button = document.createElement('button');
  button.id = 'btnCatalog';
  button.className = 'mbtn';
  button.type = 'button';
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-controls', 'catalogOverlay');

  const configButton = document.getElementById('btnConfig');
  menu.insertBefore(button, configButton || null);

  const statList = document.querySelector('#cardInfo .tstat');
  let statValue = null;
  if (statList) {
    const row = document.createElement('div');
    const dt = document.createElement('dt');
    dt.textContent = '家具図鑑';
    statValue = document.createElement('dd');
    statValue.id = 'catalogStat';
    row.append(dt, statValue);
    statList.appendChild(row);
  }

  const overlay = document.createElement('div');
  overlay.id = 'catalogOverlay';
  overlay.className = 'catalogOverlay hidden';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'catalogTitle');

  const panel = document.createElement('section');
  panel.className = 'catalogPanel';

  const head = document.createElement('div');
  head.className = 'catalogHead';
  const heading = document.createElement('h2');
  heading.id = 'catalogTitle';
  heading.textContent = '家具図鑑';
  const english = document.createElement('small');
  english.textContent = 'KAGUMIN COLLECTION';
  heading.appendChild(english);

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'catalogClose';
  close.textContent = '✕ 閉じる';
  close.setAttribute('aria-label', '家具図鑑を閉じる');
  head.append(heading, close);

  const lead = document.createElement('p');
  lead.className = 'catalogLead';
  lead.textContent = 'ゲーム中に一度でも擬態した家具タイプが登録される。クリアだけでは埋まらない、カグミンの変身記録。';

  const progressRow = document.createElement('div');
  progressRow.className = 'catalogProgressRow';
  const track = document.createElement('div');
  track.className = 'catalogProgressTrack';
  track.setAttribute('aria-hidden', 'true');
  const fill = document.createElement('div');
  fill.className = 'catalogProgressFill';
  track.appendChild(fill);
  const progressText = document.createElement('b');
  progressText.className = 'catalogProgressText';
  progressRow.append(track, progressText);

  const badge = document.createElement('p');
  badge.className = 'catalogBadge hidden';
  badge.textContent = '👑 家具博士　全タイプ変身 COMPLETE！';

  const grid = document.createElement('div');
  grid.className = 'catalogGrid';

  panel.append(head, lead, progressRow, badge, grid);
  overlay.appendChild(panel);
  title.appendChild(overlay);

  function render() {
    const progress = catalogProgress();
    button.textContent = `家具図鑑 ${progress.count}/${progress.total}`;
    if (statValue) statValue.textContent = `${progress.count}/${progress.total}`;
    progressText.textContent = `${progress.count}/${progress.total}`;
    fill.style.width = `${progress.total ? (progress.count / progress.total) * 100 : 0}%`;
    badge.classList.toggle('hidden', !progress.complete);

    grid.replaceChildren();
    for (const entry of catalogEntries()) {
      const card = document.createElement('article');
      card.className = 'catalogEntry' + (entry.discovered ? '' : ' locked');

      const icon = document.createElement('div');
      icon.className = 'catalogEntryIcon';
      icon.textContent = entry.discovered ? entry.icon : '❓';
      const name = document.createElement('h3');
      name.textContent = entry.discovered ? entry.catalogName : '？？？';
      card.append(icon, name);

      if (entry.discovered) {
        const trait = document.createElement('p');
        trait.className = 'catalogTrait';
        trait.textContent = `${POSE_NAMES[entry.pose] || entry.pose}　｜　${entry.name}`;
        const desc = document.createElement('p');
        desc.className = 'catalogDesc';
        desc.textContent = entry.desc;
        card.append(trait, desc);
      } else {
        const hint = document.createElement('p');
        hint.textContent = 'どこかのステージで擬態すると登録';
        card.appendChild(hint);
      }
      grid.appendChild(card);
    }
  }

  function closeOtherTitleCards() {
    for (const id of ['btnHow', 'btnConfig', 'btnTraining', 'btnKishin']) {
      const other = document.getElementById(id);
      if (other?.getAttribute('aria-expanded') === 'true') other.click();
    }
  }

  function openCatalog() {
    closeOtherTitleCards();
    render();
    overlay.classList.remove('hidden');
    button.setAttribute('aria-expanded', 'true');
    queueMicrotask(() => document.documentElement.classList.add('title-card-open'));
    window.requestAnimationFrame(() => close.focus({ preventScroll: true }));
  }

  function closeCatalog({ moveFocus = true } = {}) {
    overlay.classList.add('hidden');
    button.setAttribute('aria-expanded', 'false');
    const anotherOpen = ['btnHow', 'btnConfig', 'btnTraining', 'btnKishin'].some((id) =>
      document.getElementById(id)?.getAttribute('aria-expanded') === 'true');
    if (!anotherOpen) document.documentElement.classList.remove('title-card-open');
    if (moveFocus) button.focus({ preventScroll: true });
  }

  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (overlay.classList.contains('hidden')) openCatalog();
    else closeCatalog();
  });
  close.addEventListener('click', closeCatalog);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) closeCatalog();
  });
  overlay.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeCatalog();
    } else if (event.key === 'Tab') {
      event.preventDefault();
      close.focus();
    }
  });
  window.addEventListener(CATALOG_EVENT, render);

  // あそびかた/設定/特訓のいずれかが開かれたときも、図鑑を開いたまま
  // 二重に前面表示されないよう閉じる（逆方向は closeOtherTitleCards が担当）。
  for (const id of ['btnHow', 'btnConfig', 'btnTraining', 'btnKishin']) {
    const other = document.getElementById(id);
    if (!other) continue;
    const observer = new MutationObserver(() => {
      if (other.getAttribute('aria-expanded') === 'true' && !overlay.classList.contains('hidden')) {
        closeCatalog({ moveFocus: false });
      }
    });
    observer.observe(other, { attributes: true, attributeFilter: ['aria-expanded'] });
  }

  render();
}

installMimicDiscovery();
installCatalogUi();
