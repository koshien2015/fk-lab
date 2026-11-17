/**
 * 接触点ピッカー。キッカーから見たボール正面を円で描き、蹴る点をドラッグで選ぶ。
 */
import { CONTACT_LIMIT, clampContact } from '../physics/kick.ts';

type Contact = readonly [number, number];

export interface ContactPicker {
  readonly element: HTMLCanvasElement;
  render(contact: Contact): void;
}

const SIZE = 168;
const BALL_RADIUS = 70;
const ACCENT = '#5ad1ff';

function drawBall(ctx: CanvasRenderingContext2D): void {
  const c = SIZE / 2;
  const shade = ctx.createRadialGradient(c - 20, c - 24, 8, c, c, BALL_RADIUS);
  shade.addColorStop(0, '#ffffff');
  shade.addColorStop(1, '#b9c0cc');
  ctx.fillStyle = shade;
  ctx.beginPath();
  ctx.arc(c, c, BALL_RADIUS, 0, Math.PI * 2);
  ctx.fill();

  // 模様の手がかり（中央の五角形と、そこから伸びる縫い目）
  ctx.save();
  ctx.beginPath();
  ctx.arc(c, c, BALL_RADIUS, 0, Math.PI * 2);
  ctx.clip();
  const corner = (i: number, r: number): [number, number] => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    return [c + r * Math.cos(a), c + r * Math.sin(a)];
  };
  ctx.fillStyle = 'rgba(24, 26, 34, 0.82)';
  ctx.beginPath();
  for (let i = 0; i < 5; i++) ctx.lineTo(...corner(i, 20));
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(60, 66, 80, 0.55)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(...corner(i, 20));
    ctx.lineTo(...corner(i, 46));
    ctx.stroke();
    ctx.fillStyle = 'rgba(24, 26, 34, 0.7)';
    ctx.beginPath();
    ctx.arc(...corner(i + 0.5, 76), 22, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // 蹴れる範囲と十字
  ctx.strokeStyle = 'rgba(90, 209, 255, 0.35)';
  ctx.setLineDash([4, 4]);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(c, c, BALL_RADIUS * CONTACT_LIMIT, 0, Math.PI * 2);
  ctx.moveTo(c - BALL_RADIUS, c);
  ctx.lineTo(c + BALL_RADIUS, c);
  ctx.moveTo(c, c - BALL_RADIUS);
  ctx.lineTo(c, c + BALL_RADIUS);
  ctx.stroke();
  ctx.setLineDash([]);
}

export function createContactPicker(onChange: (contact: Contact) => void): ContactPicker {
  const element = document.createElement('canvas');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  element.width = SIZE * dpr;
  element.height = SIZE * dpr;
  element.className = 'contact-picker';
  element.setAttribute('role', 'img');
  element.setAttribute('aria-label', 'ボールのどこを蹴るか。ドラッグで選ぶ');
  const ctx = element.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D が使えません');
  ctx.scale(dpr, dpr);

  const pick = (event: PointerEvent): void => {
    const rect = element.getBoundingClientRect();
    const scale = SIZE / rect.width;
    const x = (event.clientX - rect.left) * scale - SIZE / 2;
    const y = (event.clientY - rect.top) * scale - SIZE / 2;
    onChange(clampContact([x / BALL_RADIUS, -y / BALL_RADIUS]));
  };
  element.addEventListener('pointerdown', (event) => {
    element.setPointerCapture(event.pointerId);
    pick(event);
  });
  element.addEventListener('pointermove', (event) => {
    if (element.hasPointerCapture(event.pointerId)) pick(event);
  });
  element.addEventListener('dblclick', () => onChange([0, 0]));

  return {
    element,
    render([u, w]) {
      ctx.clearRect(0, 0, SIZE, SIZE);
      drawBall(ctx);
      const x = SIZE / 2 + u * BALL_RADIUS;
      const y = SIZE / 2 - w * BALL_RADIUS;
      ctx.fillStyle = 'rgba(90, 209, 255, 0.25)';
      ctx.beginPath();
      ctx.arc(x, y, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = ACCENT;
      ctx.strokeStyle = '#04121c';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    },
  };
}
