// 各ステージの開始直後に「部屋の中が見える」構図を作る。
//
// 実データは stageRegistry.js に集約し、このファイルは従来の START_VIEWS API を
// 提供する互換レイヤにする。既存コードやテストはそのまま利用できる。
import { STAGE_DEFINITIONS } from './stageRegistry.js';

export const START_VIEWS = Object.freeze(Object.fromEntries(
  STAGE_DEFINITIONS.map(({ id, startView }) => [id, startView]),
));

/** yaw から水平方向の視線ベクトルを返す（カメラは -(sin, cos) 方向を見る） */
export function viewDirection(yaw) {
  return { x: -Math.sin(yaw), z: -Math.cos(yaw) };
}
