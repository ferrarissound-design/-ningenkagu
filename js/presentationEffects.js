// 鬼神・異変など「ゲームの意味が変わった瞬間」を視覚で伝える。
// ロジック側はイベントを投げるだけにして、DOM演出はここへ隔離する。
import { GAME_EVENT, onGameEvent } from './gameEvents.js';
import { onGameState } from './gameState.js';
import { GAME_MODE } from './gameModes.js';

function install() {
  if (document.getElementById('majorFxStyles')) return;
  const style = document.createElement('style');
  style.id = 'majorFxStyles';
  style.textContent = `
    #majorFx {
      position: fixed; inset: 0; z-index: 70; pointer-events: none;
      opacity: 0; mix-blend-mode: screen;
    }
    #majorFx.kishin {
      animation: kishinBurst .72s ease-out;
      background:
        radial-gradient(circle at 50% 48%, rgba(255,255,255,.82) 0 5%, rgba(255,65,20,.52) 18%, rgba(130,0,0,.22) 48%, transparent 72%);
    }
    #majorFx.anomaly {
      animation: anomalyBurst .9s ease-out;
      background:
        radial-gradient(circle at 50% 50%, rgba(205,245,255,.35), rgba(94,55,160,.28) 35%, transparent 72%);
    }
    html.kishin-running #app::after {
      content: ''; position: fixed; inset: 0; pointer-events: none; z-index: 5;
      box-shadow: inset 0 0 90px rgba(150,0,0,.22);
      animation: kishinVignette 2.8s ease-in-out infinite;
    }
    html.kishin-shake #app { animation: kishinShake .42s ease-out; }
    @keyframes kishinBurst { 0%{opacity:0} 12%{opacity:1} 100%{opacity:0} }
    @keyframes anomalyBurst { 0%{opacity:0} 18%{opacity:.85} 100%{opacity:0} }
    @keyframes kishinVignette { 0%,100%{opacity:.35} 50%{opacity:.72} }
    @keyframes kishinShake {
      0%,100%{transform:translate(0,0)}
      20%{transform:translate(-5px,2px)}
      42%{transform:translate(6px,-2px)}
      64%{transform:translate(-3px,1px)}
      82%{transform:translate(2px,0)}
    }
    @media (prefers-reduced-motion: reduce) {
      html.kishin-running #app::after { animation: none; }
      html.kishin-shake #app { animation: none; }
      #majorFx.kishin, #majorFx.anomaly { animation-duration: .12s; }
    }
  `;
  document.head.appendChild(style);

  const fx = document.createElement('div');
  fx.id = 'majorFx';
  fx.setAttribute('aria-hidden', 'true');
  document.body.appendChild(fx);
}

function flash(kind) {
  install();
  const fx = document.getElementById('majorFx');
  if (!fx) return;
  fx.className = '';
  void fx.offsetWidth;
  fx.className = kind;
  window.setTimeout(() => { if (fx.className === kind) fx.className = ''; }, 950);
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  install();

  onGameEvent(GAME_EVENT.RUN_START, ({ game }) => {
    document.documentElement.classList.toggle('kishin-running', game?.mode === GAME_MODE.KISHIN);
    if (game?.mode === GAME_MODE.KISHIN) flash('kishin');
  });

  onGameEvent(GAME_EVENT.KISHIN_SHIFT, ({ game, personality }) => {
    flash('kishin');
    document.documentElement.classList.add('kishin-shake');
    if (game?.oni) {
      game.oni.inspectFlash = Math.max(game.oni.inspectFlash || 0, .55);
      game.oni.root.scale.setScalar(1.18);
      window.setTimeout(() => game.oni?.root?.scale?.setScalar(1), 520);
    }
    window.setTimeout(() => document.documentElement.classList.remove('kishin-shake'), 520);
    if (game?.hud && personality) {
      game.hud.eventNotice('🔥 鬼相変化！', `${personality.icon} ${personality.name}へ変貌`, 'alarm', 2100);
    }
  });

  onGameEvent(GAME_EVENT.ANOMALY_START, () => flash('anomaly'));

  onGameEvent(GAME_EVENT.HABIT_LEARNED, ({ game, habit }) => {
    if (game?.hud && habit) game.hud.eventNotice(`👹 鬼がクセを読んだ　${habit.icon} ${habit.name}`, habit.desc, 'alarm', 2200);
  });

  onGameState((state) => {
    if (state === 'title' || state === 'win' || state === 'lose') {
      document.documentElement.classList.remove('kishin-running', 'kishin-shake');
    }
  });
}
