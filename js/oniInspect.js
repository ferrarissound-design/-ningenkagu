// 鬼の「家具検査モード」（INSPECT）の一連の動作。
// applyInspectBehavior(Oni.prototype) で Oni クラスへ後付けするミックスイン。
// メソッド内の this は通常どおり呼び出し元の Oni インスタンスを指す。
import { clamp, damp, randRange, angleDelta } from './utils.js';
import { STATE, INSPECT } from './oniConstants.js';

export function applyInspectBehavior(OniProto) {
  Object.assign(OniProto, {
    /** 検査の1動作を作る。s は残り時間が少ないときの短縮率 */
    makeInspectAct(kind, s) {
      switch (kind) {
        case 'flank':
          return {
            kind, e: 0, t: randRange(2.2, 2.9) * s,
            dir: Math.random() < 0.5 ? -1 : 1,
            goal: randRange(1.1, 1.9), swept: 0, bounces: 0,
          };
        case 'feint': {
          const a = {
            kind, e: 0, tAway: 0.4, tHold: randRange(0.9, 1.6) * s,
            tTele: 0.32, tSnap: 0.24, tStare: 0.7 * s, cued: 0,
          };
          a.t = a.tAway + a.tHold + a.tTele + a.tSnap + a.tStare;
          return a;
        }
        case 'peek': {
          const a = {
            kind, e: 0, tAway: 0.3, tHold: randRange(0.6, 1.1) * s,
            tTele: 0.26, tSnap: 0.16, tStare: 0.5 * s, cued: 0,
            side: Math.random() < 0.5 ? -1 : 1,
          };
          a.t = a.tAway + a.tHold + a.tTele + a.tSnap + a.tStare;
          return a;
        }
        default:
          return { kind: 'approach', e: 0, t: randRange(1.9, 2.5) * s, stop: randRange(1.6, 2.3) };
      }
    },

    beginInspect() {
      const short = !!this.inspectShort;
      // 短縮率に性格タイプの「検査の丁寧さ」を掛ける（疑り深い鬼は少し長い）
      const s = (short ? 0.68 : 1) * this.tune.inspectActScale;
      // 必ず「接近して凝視」から入り、そのあとを毎回ランダムに変える
      const rest = ['flank', 'feint', 'peek'];
      for (let i = rest.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [rest[i], rest[j]] = [rest[j], rest[i]];
      }
      const kinds = ['approach', rest[0]];
      const extraChance = clamp(INSPECT.extraActChance * this.tune.inspectExtraScale, 0, 0.95);
      if (!short && Math.random() < extraChance) kinds.push(rest[1]);

      this.inspectActs = kinds.map((k) => this.makeInspectAct(k, s));
      this.inspectAct = this.inspectActs.shift();
      this.state = STATE.INSPECT;
      this.inspectWatching = true;
      this.inspectFinished = false;
      this.inspectDoneHold = 0;
      this.inspectPending = false;
      this.inspectFlash = 0;
      this.inspectAnchor.set(this.seenX, 0, this.seenZ);
      this.lastSeen.copy(this.inspectAnchor);
      this.stuckTimer = 0;
      // 万一どこかで詰まっても必ず抜けられるようにする保険
      this.inspectTimeout = this.inspectActs.reduce((n, a) => n + a.t, this.inspectAct.t) + 3.0;
      this.inspectCue = 'start';
    },

    /** game 側が音・HUD に使う合図を1回だけ取り出す */
    consumeInspectCue() {
      const c = this.inspectCue;
      this.inspectCue = null;
      return c;
    },

    /** 検査を終える。success なら巡回へ、失敗ならもう一度じっと見張る */
    endInspect(success) {
      this.inspectActs.length = 0;
      this.inspectAct = null;
      this.inspectFinished = false;
      this.inspectDoneHold = 0;
      this.inspectWatching = true;
      this.inspectPending = false;
      this.inspectFlash = 0;
      this.inspectCooldown = this.rollInspectCooldown();
      if (this.state === STATE.FOUND) return;
      if (success) {
        this.state = STATE.PATROL;
        this.stareTimer = 0;
        this.pickWaypoint();
      } else {
        // 失敗しても即発見にはしない。もう少しだけ見張ってから諦める
        this.state = STATE.SUSPECT;
        this.stareTimer = 6;
      }
    },

    /** 決着・ステージ切替などで検査を強制終了する */
    abortInspect() {
      if (this.state === STATE.INSPECT) this.state = STATE.SUSPECT;
      this.inspectActs.length = 0;
      this.inspectAct = null;
      this.inspectFinished = false;
      this.inspectDoneHold = 0;
      this.inspectWatching = true;
      this.inspectPending = false;
      this.inspectCue = null;
      this.inspectFlash = 0;
      this.inspectCooldown = this.rollInspectCooldown();
    },

    /** 対象の方をどれだけ速く向くか */
    faceAnchor(dt, rate, back = false) {
      const p = this.root.position;
      let want = Math.atan2(this.inspectAnchor.x - p.x, this.inspectAnchor.z - p.z);
      if (back) want += Math.PI;
      this.facing += angleDelta(this.facing, want) * Math.min(1, dt * rate);
      return want;
    },

    updateInspect(dt) {
      this.inspectTimeout -= dt;
      // 見ている間だけ「調べている場所」がプレイヤーに追従する
      if (this.inspectWatching) {
        this.inspectAnchor.x = damp(this.inspectAnchor.x, this.seenX, 5, dt);
        this.inspectAnchor.z = damp(this.inspectAnchor.z, this.seenZ, 5, dt);
        this.lastSeen.copy(this.inspectAnchor);
      }

      if (this.inspectFinished) {
        // game 側の判定待ち。放置されても止まったままにならないよう自分で切り上げる
        this.updateInspectStare(dt);
        this.inspectDoneHold += dt;
        if (this.inspectDoneHold > 1.5) this.endInspect(true);
        return;
      }
      if (this.inspectTimeout <= 0) { this.inspectFinished = true; return; }

      const a = this.inspectAct;
      if (!a) { this.inspectFinished = true; return; }
      a.e += dt;
      switch (a.kind) {
        case 'flank': this.actFlank(dt, a); break;
        case 'feint': this.actFeint(dt, a); break;
        case 'peek': this.actPeek(dt, a); break;
        default: this.actApproach(dt, a); break;
      }
      if (a.e >= a.t || a.done) {
        this.inspectAct = this.inspectActs.shift() || null;
        this.stuckTimer = 0;
        if (!this.inspectAct) this.inspectFinished = true;
      }
    },

    /** 動かずに正面から見つめる */
    updateInspectStare(dt) {
      this.speed = damp(this.speed, 0, 12, dt);
      this.headSweep = damp(this.headSweep, 0, 8, dt);
      this.faceAnchor(dt, 6);
    },

    /** 1. 接近して凝視：1.5〜2.5m まで近づいて数秒じっと見る */
    actApproach(dt, a) {
      this.inspectWatching = true;
      this.headSweep = damp(this.headSweep, 0, 8, dt);
      const p = this.root.position;
      let dx = p.x - this.inspectAnchor.x;
      let dz = p.z - this.inspectAnchor.z;
      const d = Math.hypot(dx, dz);
      if (d > a.stop + 0.15 && a.e < a.t * 0.7) {
        const tx = this.inspectAnchor.x + (dx / d) * a.stop;
        const tz = this.inspectAnchor.z + (dz / d) * a.stop;
        this.moveToward(dt, tx, tz, this.moveSpeed.approach);
        this.faceAnchor(dt, 5);
        // 家具に阻まれたら無理に詰めず、その場から観察する
        if (this.stuckTimer > 0.8) { a.e = Math.max(a.e, a.t * 0.7); this.stuckTimer = 0; }
      } else {
        this.updateInspectStare(dt);
      }
    },

    /** 2. 横から確認：対象のまわりを半周するように回り込む */
    actFlank(dt, a) {
      this.inspectWatching = true;
      this.headSweep = damp(this.headSweep, 0, 8, dt);
      const p = this.root.position;
      const ax = this.inspectAnchor.x, az = this.inspectAnchor.z;
      const before = Math.atan2(p.x - ax, p.z - az);
      const r = clamp(Math.hypot(p.x - ax, p.z - az), 1.5, 2.6);
      // 少し先の点を目標にすると、既存の移動＋衝突判定だけで円弧を描ける
      const lead = before + a.dir * 0.5;
      this.moveToward(dt, ax + Math.sin(lead) * r, az + Math.cos(lead) * r, this.moveSpeed.flank);
      // 移動方向ではなく、常に調べている物を見る
      this.faceAnchor(dt, 5);
      a.swept += Math.abs(angleDelta(before, Math.atan2(p.x - ax, p.z - az)));
      if (a.swept > a.goal) a.done = true;
      // 壁や家具に当たったら反対回り。2回ぶつかったら諦めてその場で見る
      if (this.stuckTimer > 0.45) {
        this.stuckTimer = 0;
        a.dir *= -1;
        a.bounces++;
        if (a.bounces >= 2) a.done = true;
      }
    },

    /** 3. 背中を向けるフェイント：やめたふりをして、急に振り返る */
    actFeint(dt, a) {
      const e = a.e;
      const tAway = a.tAway, tHold = tAway + a.tHold, tTele = tHold + a.tTele;
      const tSnap = tTele + a.tSnap;
      this.speed = damp(this.speed, 0, 12, dt);
      this.headSweep = damp(this.headSweep, 0, 8, dt);
      if (e < tHold) {
        // 背を向ける（プレイヤーからは「検査をやめた」ように見える）
        this.inspectWatching = false;
        this.faceAnchor(dt, 4, true);
      } else if (e < tTele) {
        // 振り返る前の予備動作。ここで気づけば止まれる
        this.inspectWatching = false;
        if (!a.cued) { a.cued = 1; this.inspectCue = 'telegraph'; this.inspectFlash = 0.45; }
        this.faceAnchor(dt, 1.2, true);
      } else if (e < tSnap) {
        if (a.cued < 2) { a.cued = 2; this.inspectCue = 'turnback'; }
        this.faceAnchor(dt, 14);
      } else {
        this.inspectWatching = true;
        this.updateInspectStare(dt);
      }
    },

    /** 4. 突然の振り返り：よそ見からの素早い向き直り（予備動作つき） */
    actPeek(dt, a) {
      const e = a.e;
      const tAway = a.tAway, tHold = tAway + a.tHold, tTele = tHold + a.tTele;
      const tSnap = tTele + a.tSnap;
      this.speed = damp(this.speed, 0, 12, dt);
      this.faceAnchor(dt, 3);
      if (e < tHold) {
        this.inspectWatching = false;
        this.headSweep = damp(this.headSweep, a.side * 1.0, 5, dt);
      } else if (e < tTele) {
        this.inspectWatching = false;
        if (!a.cued) { a.cued = 1; this.inspectCue = 'telegraph'; this.inspectFlash = 0.4; }
        this.headSweep = damp(this.headSweep, a.side * 1.15, 3, dt);
      } else if (e < tSnap) {
        if (a.cued < 2) { a.cued = 2; this.inspectCue = 'turnback'; }
        this.headSweep = damp(this.headSweep, 0, 22, dt);
      } else {
        this.inspectWatching = true;
        this.updateInspectStare(dt);
      }
    },
  });
}
