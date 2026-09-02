// stageEvents.js 本体から独立して追加されたステージイベントを登録する。
//
// ステージの3Dビルダー自身に「読み込まれると別モジュールを書き換える」副作用を
// 持たせないため、追加イベントの登録だけをこの境界へ集める。
import { STAGE_EVENTS } from './stageEvents.js';
import { sfx } from './audio.js';

STAGE_EVENTS.scienceroom = {
  id: 'steam',
  name: '蒸気が噴き出した！',
  durationMin: 6.5,
  durationMax: 8.5,
  // 蒸気は部屋側の現象なので、鬼が途中でプレイヤーを怪しんでも視界低下は残す。
  liftVisionOnBreak: false,
  onStart(m) {
    const rig = m.stage.eventRig || {};
    m.applyVision({ range: 0.48, angle: 0.62, peri: 0.72, detect: 0.38 });
    m.focusOni({ look: rig.look, spots: rig.spots, stand: 0.45, glance: 0.65 });
    m.setSteam(true);
    m.hud.eventNotice('🧪 蒸気が噴き出した！', '白煙の間に移動しろ');
    sfx.eventSteam();
  },
  onUpdate(m, dt) { m.animateSteam(dt); },
  onEnd(m) { m.setSteam(false); },
};
