// 軽量な演出（外部アセット不要）
import * as THREE from '../vendor/three/three.module.min.js';

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.rings = [];
    this.pool = [];

    // 擬態できる対象を示すマーカー
    this.markerMat = new THREE.MeshBasicMaterial({
      color: 0x7dffd0, transparent: true, opacity: 0.0,
      depthWrite: false, side: THREE.DoubleSide,
    });
    this.marker = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.44, 24), this.markerMat);
    this.marker.rotation.x = -Math.PI / 2;
    this.marker.visible = false;
    scene.add(this.marker);
    this.markerPhase = 0;
  }

  /** 対象の最も近い場所を床に円で示す */
  showMarker(target, x, z) {
    this.marker.visible = true;
    const r = target.rect;
    const cx = Math.max(r.minX, Math.min(r.maxX, x));
    const cz = Math.max(r.minZ, Math.min(r.maxZ, z));
    this.marker.position.set(cx, 0.05, cz);
  }

  hideMarker() {
    this.marker.visible = false;
  }

  /** 擬態成功時の広がるリング */
  burst(pos, color) {
    let ring = this.pool.pop();
    if (!ring) {
      const mat = new THREE.MeshBasicMaterial({
        transparent: true, depthWrite: false, side: THREE.DoubleSide,
      });
      ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.72, 24), mat);
      ring.rotation.x = -Math.PI / 2;
      this.scene.add(ring);
    }
    ring.visible = true;
    ring.material.color.copy(color);
    ring.material.opacity = 0.9;
    ring.position.set(pos.x, 0.06, pos.z);
    ring.scale.set(0.4, 0.4, 0.4);
    ring.userData.life = 0;
    this.rings.push(ring);
  }

  update(dt) {
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.userData.life += dt;
      const t = r.userData.life / 0.7;
      if (t >= 1) {
        r.visible = false;
        this.rings.splice(i, 1);
        this.pool.push(r);
        continue;
      }
      const s = 0.4 + t * 3.4;
      r.scale.set(s, s, s);
      r.material.opacity = 0.9 * (1 - t);
    }
    if (this.marker.visible) {
      this.markerPhase += dt * 3;
      this.markerMat.opacity = 0.38 + Math.sin(this.markerPhase) * 0.18;
      this.marker.rotation.z += dt * 1.2;
    }
  }
}
