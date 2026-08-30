// 鬼の見た目一式（体・頭・目・口・腕・脚・視界コーン・頭上マーク）の組み立て。
// Oni コンストラクタから呼ばれ、返り値のプロパティがそのまま this.* に代入される。
import * as THREE from '../vendor/three/three.module.min.js';

export const ONI_CONE_SEGMENTS = 26;

/** 頭の上に出す「？」「！」用のテクスチャ（外部画像を使わない） */
export function makeMarkTexture(ch, color) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  g.font = 'bold 104px system-ui, -apple-system, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.lineWidth = 16;
  g.strokeStyle = '#2b2033';
  g.strokeText(ch, 64, 68);
  g.fillStyle = color;
  g.fillText(ch, 64, 68);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** 床に置く扇形（ローカル +Z 方向が正面） */
export function buildFanGeometry(halfAngle, radius, segments) {
  const pos = [];
  for (let i = 0; i < segments; i++) {
    const a0 = -halfAngle + (2 * halfAngle * i) / segments;
    const a1 = -halfAngle + (2 * halfAngle * (i + 1)) / segments;
    pos.push(0, 0, 0);
    pos.push(Math.sin(a0) * radius, 0, Math.cos(a0) * radius);
    pos.push(Math.sin(a1) * radius, 0, Math.cos(a1) * radius);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

/**
 * 丸い一つ目の見回りモンスターの見た目一式を root の下に組み立てる。
 * view（コンストラクタ時点の性格タイプ由来の視界）は視界コーンの初期形状にだけ使う。
 */
export function buildOniVisuals(root, view) {
  const purple = 0x7658c9;
  const purpleLight = 0x9a79df;
  const purpleDark = 0x413661;
  const mk = (c, e = 0x000000, roughness = 0.72) => new THREE.MeshStandardMaterial({
    color: new THREE.Color(c), roughness, metalness: 0.05,
    emissive: new THREE.Color(e),
  });
  const sphereGeo = new THREE.SphereGeometry(1, 14, 10);
  const orb = (rx, ry, rz, c, e = 0x000000, roughness = 0.72) => {
    const m = new THREE.Mesh(sphereGeo, mk(c, e, roughness));
    m.scale.set(rx, ry, rz);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  };

  // 丸い一つ目の見回りモンスター（前は +Z）
  const body = new THREE.Group();
  root.add(body);
  const torso = orb(0.5, 0.59, 0.4, purple);
  torso.position.y = 0.96;
  body.add(torso);
  const belly = orb(0.31, 0.36, 0.04, purpleLight);
  belly.position.set(0, 0.9, 0.385);
  body.add(belly);

  const head = new THREE.Group();
  head.position.y = 1.48;
  body.add(head);
  const headMesh = orb(0.44, 0.4, 0.4, purpleLight);
  head.add(headMesh);
  // 短く丸みのある角
  for (const side of [-1, 1]) {
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.23, 8), mk(0xffe2a8));
    horn.position.set(side * 0.24, 0.4, -0.02);
    horn.rotation.z = side * -0.25;
    horn.castShadow = true;
    head.add(horn);
  }

  // 表情豊かな一つ目。目全体を伸縮して警戒状態を伝える
  const eyeGroup = new THREE.Group();
  eyeGroup.position.set(0, 0.055, 0.39);
  head.add(eyeGroup);
  const eyeWhite = orb(0.225, 0.18, 0.058, 0xfff7e7, 0x15100a, 0.45);
  eyeGroup.add(eyeWhite);
  const eyeMat = mk(0xffcf45, 0xffa91f, 0.38);
  const iris = new THREE.Mesh(sphereGeo, eyeMat);
  iris.scale.set(0.12, 0.13, 0.038);
  iris.position.z = 0.055;
  eyeGroup.add(iris);
  const pupil = orb(0.052, 0.076, 0.026, 0x21192c, 0x08050c, 0.4);
  pupil.position.z = 0.086;
  eyeGroup.add(pupil);
  const eyeBaseScale = eyeGroup.scale.clone();

  const mouth = orb(0.075, 0.027, 0.022, purpleDark, 0x08050c, 0.5);
  mouth.position.set(0, -0.205, 0.392);
  const mouthBaseScale = mouth.scale.clone();
  head.add(mouth);

  const arms = [];
  for (const side of [1, -1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.48, 1.16, 0);
    const arm = orb(0.12, 0.27, 0.12, purpleLight);
    arm.position.y = -0.24;
    pivot.add(arm);
    const hand = orb(0.145, 0.13, 0.14, purpleLight);
    hand.position.y = -0.49;
    pivot.add(hand);
    body.add(pivot);
    arms.push({ pivot, side });
  }
  const legs = [];
  for (const side of [1, -1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.18, 0.62, 0);
    const leg = orb(0.14, 0.28, 0.16, purpleDark);
    leg.position.y = -0.24;
    pivot.add(leg);
    const foot = orb(0.18, 0.12, 0.24, purpleDark);
    foot.position.set(0, -0.48, 0.065);
    pivot.add(foot);
    body.add(pivot);
    legs.push({ pivot, side });
  }

  // 視界コーン（床のファン）
  const coneMat = new THREE.MeshBasicMaterial({
    color: 0xffd166, transparent: true, opacity: 0.24,
    depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  const cone = new THREE.Mesh(buildFanGeometry(view.halfAngle, view.range, ONI_CONE_SEGMENTS), coneMat);
  cone.position.y = 0.03;
  root.add(cone);

  // 検査中に頭の上へ出すマーク（子供にも状態が分かるように）
  const marks = {};
  for (const [key, ch, color] of [['q', '?', '#ffd166'], ['ex', '!', '#ff8a2b']]) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeMarkTexture(ch, color), transparent: true, depthWrite: false,
    }));
    sp.scale.set(0.6, 0.6, 1);
    sp.position.set(0, 2.6, 0);
    sp.visible = false;
    root.add(sp);
    marks[key] = sp;
  }

  return { body, head, eyeGroup, eyeMat, mouth, eyeBaseScale, mouthBaseScale, arms, legs, coneMat, cone, marks };
}
