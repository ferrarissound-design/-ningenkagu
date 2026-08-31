// 各ステージの開始直後に「部屋の中が見える」構図を作る。
//
// 壁際スポーンのままだとカメラが壁に押されて極端に近くなるため、
// 開始位置を少しだけ内側へ寄せ、カメラ前方が攻略エリアへ向くようにする。
//
// yaw はカメラの方位角で、実際の視線方向は (-sin(yaw), -cos(yaw))。
// スポーンが部屋のどの隅かで符号が変わるので、値を足すときは
// tests/unit/startViews.test.mjs（前方に部屋が残っているかの検査）を必ず通すこと。

export const START_VIEWS = {
  living: {
    position: [-4.8, 0, -3.2],
    yaw: -2.20,
    pitch: 0.48,
  },
  classroom: {
    position: [-2.2, 0, 2.0],
    yaw: -Math.PI / 4,
    pitch: 0.48,
  },
  artroom: {
    position: [4.0, 0, -2.4],
    yaw: 2.15,
    pitch: 0.48,
  },
  // 図書室・理科室のスポーンは -x/+z の隅。攻略エリアは +x/-z 側にあるので、
  // リビングや美術室と同じ符号の yaw を使うと真後ろの壁を向いてしまう。
  library: {
    position: [-5.0, 0, 4.2],
    yaw: -0.76,
    pitch: 0.48,
  },
  scienceroom: {
    position: [-5.0, 0, 4.0],
    yaw: -Math.PI / 4,
    pitch: 0.48,
  },
};

/** yaw から水平方向の視線ベクトルを返す（カメラは -(sin, cos) 方向を見る） */
export function viewDirection(yaw) {
  return { x: -Math.sin(yaw), z: -Math.cos(yaw) };
}
