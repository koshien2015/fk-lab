/**
 * 描画の土台（レンダラー、カメラ、照明、毎フレームの呼び出し）。
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Spot } from '../field/placement.ts';
import type { CameraView } from './cameraViews.ts';

export interface Stage {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  readonly canvas: HTMLCanvasElement;
  setView(view: CameraView): void;
  /** 画面上の点が指す地面（y = 0）の位置。地面を指していなければ null。 */
  groundPoint(clientX: number, clientY: number): Spot | null;
  /** 画面上の点が指すゴールライン上の面（x = 0）の位置 */
  goalPlanePoint(clientX: number, clientY: number): { y: number; z: number } | null;
  /** 毎フレーム呼ぶ関数を登録する。引数は前フレームからの経過秒。 */
  onFrame(callback: (dt: number) => void): void;
}

function createLights(): THREE.Object3D[] {
  const sky = new THREE.HemisphereLight(0xa9c1ff, 0x1c3a1f, 0.75);
  const key = new THREE.DirectionalLight(0xfff4e0, 2.2);
  key.position.set(-38, 46, 26);
  key.target.position.set(-14, 0, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -34;
  key.shadow.camera.right = 34;
  key.shadow.camera.top = 30;
  key.shadow.camera.bottom = -30;
  key.shadow.camera.near = 10;
  key.shadow.camera.far = 120;
  key.shadow.bias = -0.0004;
  return [sky, key, key.target];
}

export function createStage(container: HTMLElement): Stage {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  container.append(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x070b16);
  scene.fog = new THREE.Fog(0x070b16, 90, 220);
  scene.add(...createLights());

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 400);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI / 2 - 0.02;
  controls.minDistance = 2;
  controls.maxDistance = 90;

  const resize = (): void => {
    const { clientWidth: w, clientHeight: h } = container;
    renderer.setSize(w, h);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
  };
  resize();
  new ResizeObserver(resize).observe(container);

  const raycaster = new THREE.Raycaster();
  const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hit = new THREE.Vector3();
  const goalPlane = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);
  /** 画面上の点から伸ばした視線が、平面と交わる点 */
  const pointOn = (plane: THREE.Plane, clientX: number, clientY: number): THREE.Vector3 | null => {
    const rect = renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(ndc, camera);
    return raycaster.ray.intersectPlane(plane, hit);
  };
  const groundPoint = (clientX: number, clientY: number): Spot | null => {
    const point = pointOn(ground, clientX, clientY);
    return point ? { x: point.x, z: point.z } : null;
  };
  const goalPlanePoint = (clientX: number, clientY: number): { y: number; z: number } | null => {
    const point = pointOn(goalPlane, clientX, clientY);
    return point ? { y: point.y, z: point.z } : null;
  };

  const callbacks: Array<(dt: number) => void> = [];
  const timer = new THREE.Timer();
  renderer.setAnimationLoop((now: number) => {
    timer.update(now);
    const dt = Math.min(timer.getDelta(), 0.1);
    for (const callback of callbacks) callback(dt);
    controls.update();
    renderer.render(scene, camera);
  });

  return {
    scene,
    camera,
    controls,
    canvas: renderer.domElement,
    setView(view) {
      camera.position.set(...view.position);
      controls.target.set(...view.target);
      controls.update();
    },
    groundPoint,
    goalPlanePoint,
    onFrame: (callback) => void callbacks.push(callback),
  };
}
