/**
 * カメラの動かし方。固定の視点は一度だけ合わせ、追う視点は毎フレームなめらかに寄せる。
 */
import type { Spot } from '../field/placement.ts';
import {
  followView,
  goalView,
  isTracking,
  keeperView,
  kickerView,
  sideView,
  topView,
  type BallMotion,
  type CameraMode,
  type CameraView,
} from './cameraViews.ts';
import type { Stage } from './stage.ts';

export interface CameraRig {
  mode(): CameraMode;
  setMode(mode: CameraMode, spot: Spot): void;
  /** 固定の視点を、いまのボールの位置に合わせ直す */
  reset(spot: Spot): void;
  /**
   * 構え直したときに呼ぶ。ボールの位置が変わったか、ゴールの寄りの視点のあとなら合わせ直す。
   * それ以外は、ユーザーがドラッグで回した視点をそのまま残す。
   */
  settle(spot: Spot): void;
  /** 毎フレーム呼ぶ。cinematic はゴールの瞬間の寄りの視点。 */
  update(dt: number, ball: BallMotion, cinematic: boolean): void;
}

/** 追う視点が目標へ寄る速さ [1/s] */
const FOLLOW_RATE = 5;

function staticView(mode: CameraMode, spot: Spot): CameraView {
  if (mode === 'top') return topView(spot);
  if (mode === 'side') return sideView(spot);
  return kickerView(spot);
}

export function createCameraRig(stage: Stage): CameraRig {
  let mode: CameraMode = 'kicker';
  let heading: readonly [number, number] = [1, 0];
  let wasCinematic = false;
  let lastSpot: Spot | null = null;

  /** 視点を目標へなめらかに寄せる */
  const ease = (view: CameraView, dt: number): void => {
    const k = 1 - Math.exp(-FOLLOW_RATE * dt);
    const { camera, controls } = stage;
    camera.position.x += (view.position[0] - camera.position.x) * k;
    camera.position.y += (view.position[1] - camera.position.y) * k;
    camera.position.z += (view.position[2] - camera.position.z) * k;
    controls.target.x += (view.target[0] - controls.target.x) * k;
    controls.target.y += (view.target[1] - controls.target.y) * k;
    controls.target.z += (view.target[2] - controls.target.z) * k;
  };

  const reset = (spot: Spot): void => {
    heading = [-spot.x / Math.hypot(spot.x, spot.z), -spot.z / Math.hypot(spot.x, spot.z)];
    wasCinematic = false;
    lastSpot = spot;
    stage.controls.enabled = !isTracking(mode);
    if (!isTracking(mode)) stage.setView(staticView(mode, spot));
  };

  return {
    mode: () => mode,
    setMode(next, spot) {
      mode = next;
      reset(spot);
    },
    reset,
    settle(spot) {
      const moved = !lastSpot || lastSpot.x !== spot.x || lastSpot.z !== spot.z;
      if (moved || wasCinematic) reset(spot);
    },
    update(dt, ball, cinematic) {
      const speed = Math.hypot(ball.velocity[0], ball.velocity[2]);
      if (speed > 2) heading = [ball.velocity[0] / speed, ball.velocity[2] / speed];

      if (cinematic || wasCinematic) {
        // いちど寄ったら、構え直すまで寄ったままにする
        wasCinematic = true;
        stage.controls.enabled = false;
        ease(goalView(ball), dt);
        return;
      }
      if (mode === 'keeper') ease(keeperView(ball), dt);
      if (mode === 'follow') ease(followView(ball, heading), dt);
    },
  };
}
