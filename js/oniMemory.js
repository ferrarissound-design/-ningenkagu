// 鬼の短期記憶。
// 同じ家具への擬態を繰り返すほど「さっきも怪しかった」という圧が増す。
// 60秒の1プレイ内だけで完結し、reset() で完全に忘れる。

const BASE_PROFILE = {
  repeatGain: 0.13,       // 同じ家具を再利用したときの見抜く力上昇
  kindGain: 0,            // 同種の別家具まで疑う強さ
  inspectGain: 0.16,      // 再利用時の家具検査率上昇
  maxDetectScale: 1.5,
  maxInspectScale: 1.6,
};

export const ONI_MEMORY_PROFILES = {
  watcher: {
    ...BASE_PROFILE,
    repeatGain: 0.18,
    kindGain: 0.01,
    inspectGain: 0.14,
    maxDetectScale: 1.55,
    maxInspectScale: 1.55,
  },
  charger: {
    ...BASE_PROFILE,
    repeatGain: 0.06,
    kindGain: 0,
    inspectGain: 0.05,
    maxDetectScale: 1.2,
    maxInspectScale: 1.2,
  },
  suspicious: {
    ...BASE_PROFILE,
    repeatGain: 0.20,
    kindGain: 0.04,
    inspectGain: 0.23,
    maxDetectScale: 1.70,
    maxInspectScale: 1.85,
  },
};

const neutral = () => ({
  detectScale: 1,
  inspectScale: 1,
  targetUses: 0,
  kindUses: 0,
  remembered: false,
});

export class OniMemory {
  constructor(personalityId = 'watcher') {
    this.setPersonality(personalityId);
    this.reset();
  }

  setPersonality(personalityId) {
    this.personalityId = personalityId;
    this.profile = ONI_MEMORY_PROFILES[personalityId] || BASE_PROFILE;
  }

  reset() {
    this.targetUses = new Map();
    this.kindUses = new Map();
    this.lastTarget = null;
    this.current = neutral();
  }

  /**
   * 現在の擬態対象を観察する。
   * 同じ対象を見続けているだけでは回数を増やさず、別の家具へ移ってから
   * 戻ってきたときに初めて「再利用」として記憶を1段強くする。
   */
  observe(target) {
    if (!target) {
      this.current = neutral();
      return this.current;
    }

    if (target !== this.lastTarget) {
      const uses = (this.targetUses.get(target) || 0) + 1;
      this.targetUses.set(target, uses);

      const kind = target.kind || '';
      if (kind) this.kindUses.set(kind, (this.kindUses.get(kind) || 0) + 1);
      this.lastTarget = target;
    }

    const targetUses = this.targetUses.get(target) || 1;
    const kindUses = target.kind ? (this.kindUses.get(target.kind) || 1) : 1;
    const repeats = Math.max(0, targetUses - 1);
    // 同じ個体の再利用ぶんは repeatGain が担当するので、kindGain は
    // 「同種の別家具へ渡り歩いた回数」だけを見る。
    const sameKindOthers = Math.max(0, kindUses - targetUses);
    const p = this.profile;
    const detectScale = Math.min(
      p.maxDetectScale,
      1 + repeats * p.repeatGain + sameKindOthers * p.kindGain,
    );
    const inspectScale = Math.min(
      p.maxInspectScale,
      1 + repeats * p.inspectGain + sameKindOthers * p.kindGain,
    );

    this.current = {
      detectScale,
      inspectScale,
      targetUses,
      kindUses,
      remembered: repeats > 0 || sameKindOthers > 0,
    };
    return this.current;
  }

  info() { return { ...this.current, personalityId: this.personalityId }; }
}
