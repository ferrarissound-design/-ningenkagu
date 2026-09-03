// ニンゲン家具のオフライン起動用 Service Worker。
// 初回オンライン訪問時にゲーム本体一式を保存し、以降は通信がなくても起動できる。

const CACHE_NAME = 'ningenkagu-app-v5';
const CORE_PATHS = [
  './',
  './index.html',
  './css/style.css',
  './manifest.json',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/audio/behind_the_potted_plant.mp3',
  './assets/audio/gold_medal_morning.mp3',
  './vendor/three/three.module.min.js',

  './js/audio.js',
  './js/battleBgm.js',
  './js/completionUi.js',
  './js/effects.js',
  './js/furnitureKinds.js',
  './js/furnitureTraits.js',
  './js/game.js',
  './js/gameState.js',
  './js/hud.js',
  './js/input.js',
  './js/main.js',
  './js/mastery.js',
  './js/masteryUi.js',
  './js/mission.js',
  './js/missionUi.js',
  './js/oni.js',
  './js/oniConstants.js',
  './js/oniInspect.js',
  './js/oniMemory.js',
  './js/oniPersonalities.js',
  './js/oniProgress.js',
  './js/oniVisuals.js',
  './js/opening.js',
  './js/player.js',
  './js/rank.js',
  './js/saveData.js',
  './js/settings.js',
  './js/appShell.js',
  './js/stage.js',
  './js/stageBuilder.js',
  './js/stageEvents.js',
  './js/stageRegistry.js',
  './js/startViews.js',
  './js/titleMenu.js',
  './js/utils.js',
  './js/stages/living.js',
  './js/stages/classroom.js',
  './js/stages/artroom.js',
  './js/stages/library.js',
  './js/stages/scienceroom.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(CORE_PATHS);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter((name) => name.startsWith('ningenkagu-app-') && name !== CACHE_NAME)
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);

    // HTMLナビゲーションだけは新しい版を優先する。通信不能なら保存済みの入口へ戻す。
    if (request.mode === 'navigate') {
      try {
        const response = await fetch(request);
        if (response.ok) await cache.put('./index.html', response.clone());
        return response;
      } catch (error) {
        return (await cache.match('./index.html')) || (await cache.match('./'));
      }
    }

    const cached = await cache.match(request);
    if (cached) {
      // 表示は即キャッシュから返し、裏で次回用の内容だけ更新する。
      event.waitUntil(fetch(request).then(async (response) => {
        if (response.ok && !request.headers.has('range')) await cache.put(request, response.clone());
      }).catch(() => {}));
      return cached;
    }

    try {
      const response = await fetch(request);
      if (response.ok && !request.headers.has('range')) await cache.put(request, response.clone());
      return response;
    } catch (error) {
      // 音声など、初回キャッシュ対象外のリソースがオフラインで失敗しても、
      // ここではネットワークエラーをそのまま返す。ゲーム本体は継続できる。
      throw error;
    }
  })());
});
