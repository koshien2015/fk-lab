/**
 * ボールのパネル模様を、正距円筒図法のテクスチャに描く（起動時に 1 回）。
 */
import * as THREE from 'three';
import { panelAt } from './ballPattern.ts';

const WIDTH = 1024;
const HEIGHT = 512;
const PENTAGON = [24, 26, 34];
const HEXAGON = [244, 244, 238];
const SEAM = [120, 124, 132];
/** 縫い目の太さ（panelAt の edgeDistance の単位） */
const SEAM_WIDTH = 0.006;

export function createBallTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D が使えません');
  const image = ctx.createImageData(WIDTH, HEIGHT);

  for (let py = 0; py < HEIGHT; py++) {
    const polar = ((py + 0.5) / HEIGHT) * Math.PI;
    const ring = Math.sin(polar);
    for (let px = 0; px < WIDTH; px++) {
      const azimuth = ((px + 0.5) / WIDTH) * 2 * Math.PI;
      // THREE.SphereGeometry の UV と同じ向き
      const panel = panelAt([-Math.cos(azimuth) * ring, Math.cos(polar), Math.sin(azimuth) * ring]);
      const fill = panel.kind === 'pentagon' ? PENTAGON : HEXAGON;
      const t = Math.min(1, panel.edgeDistance / SEAM_WIDTH);
      const blend = t * t * (3 - 2 * t);
      const offset = (py * WIDTH + px) * 4;
      for (let c = 0; c < 3; c++) {
        image.data[offset + c] = SEAM[c] + (fill[c] - SEAM[c]) * blend;
      }
      image.data[offset + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}
