import fs from 'fs';
import path from 'path';
import { createCanvas } from 'canvas';

// Create icons directory
const iconsDir = path.join(process.cwd(), 'public', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Icon sizes needed for PWA
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const faviconSizes = [16, 32, 48];

function createRingGradient(ctx, size, x0, y0, x1, y1) {
  const gradient = ctx.createLinearGradient(x0 * size, y0 * size, x1 * size, y1 * size);
  gradient.addColorStop(0, '#9333ea');
  gradient.addColorStop(0.65, '#c084fc');
  gradient.addColorStop(1, 'rgba(192,132,252,0)');
  return gradient;
}

function drawRingArc(ctx, center, radius, width, startDeg, sweepDeg, strokeStyle, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.strokeStyle = strokeStyle;
  ctx.beginPath();
  const start = (startDeg * Math.PI) / 180;
  const end = ((startDeg + sweepDeg) * Math.PI) / 180;
  ctx.arc(center, center, radius, start, end);
  ctx.stroke();
  ctx.restore();
}

function drawRoundedRectPath(ctx, x, y, width, height, radius) {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawSmartStyleBrandIcon(ctx, size, options = {}) {
  const {
    rounded = true,
    cornerRadiusRatio = 0.22,
    iconPaddingRatio = 0,
    simplified = false,
  } = options;

  const inset = Math.round(size * iconPaddingRatio);
  const drawSize = size - inset * 2;
  const center = inset + drawSize / 2;

  // Matte background aligned with auth page tone.
  const bg = ctx.createLinearGradient(inset, inset, inset + drawSize, inset + drawSize);
  bg.addColorStop(0, '#050813');
  bg.addColorStop(0.55, '#130b2d');
  bg.addColorStop(1, '#211047');
  ctx.fillStyle = bg;
  ctx.fillRect(inset, inset, drawSize, drawSize);

  if (rounded) {
    ctx.save();
    ctx.globalCompositeOperation = 'destination-in';
    drawRoundedRectPath(ctx, inset, inset, drawSize, drawSize, drawSize * cornerRadiusRatio);
    ctx.fill();
    ctx.restore();
  }

  // Ambient glow behind rings.
  const glow = ctx.createRadialGradient(center, center, drawSize * 0.1, center, center, drawSize * 0.5);
  glow.addColorStop(0, 'rgba(192,132,252,0.34)');
  glow.addColorStop(1, 'rgba(192,132,252,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(center, center, drawSize * 0.48, 0, Math.PI * 2);
  ctx.fill();

  const outerGradient = createRingGradient(ctx, drawSize, 0, 1, 1, 0);
  const middleGradient = createRingGradient(ctx, drawSize, 1, 0, 0, 1);
  const innerGradient = createRingGradient(ctx, drawSize, 0, 0, 1, 1);

  if (simplified) {
    drawRingArc(ctx, center, drawSize * 0.43, drawSize * 0.052, -15, 330, outerGradient, 0.42);
    drawRingArc(ctx, center, drawSize * 0.34, drawSize * 0.062, 18, 248, middleGradient, 1);
    drawRingArc(ctx, center, drawSize * 0.25, drawSize * 0.066, -28, 228, innerGradient, 1);
  } else {
    drawRingArc(ctx, center, drawSize * 0.44, drawSize * 0.02, -12, 330, outerGradient, 0.3);
    drawRingArc(ctx, center, drawSize * 0.36, drawSize * 0.024, 14, 250, middleGradient, 0.95);
    drawRingArc(ctx, center, drawSize * 0.28, drawSize * 0.027, -32, 228, innerGradient, 0.98);
  }

  ctx.fillStyle = '#FFFFFF';
  ctx.font = `700 ${drawSize * (simplified ? 0.38 : 0.34)}px "Space Grotesk", "Sora", "Avenir Next", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('SS', center, center + drawSize * 0.012);
}

function writePng(filePath, canvas) {
  fs.writeFileSync(filePath, canvas.toBuffer('image/png'));
}

// Generate standard PWA icons (any purpose).
sizes.forEach((size) => {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  drawSmartStyleBrandIcon(ctx, size, { rounded: true, simplified: size <= 32 });
  writePng(path.join(iconsDir, `icon-${size}x${size}.png`), canvas);
  console.log(`✅ Generated icon-${size}x${size}.png`);
});

// Generate maskable icons with extra safe-zone padding and square canvas.
[192, 512].forEach((size) => {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  drawSmartStyleBrandIcon(ctx, size, {
    rounded: false,
    iconPaddingRatio: 0.12,
  });
  writePng(path.join(iconsDir, `icon-maskable-${size}x${size}.png`), canvas);
  console.log(`✅ Generated icon-maskable-${size}x${size}.png`);
});

// Generate favicon assets from the exact same source icon.
faviconSizes.forEach((size) => {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  drawSmartStyleBrandIcon(ctx, size, {
    rounded: true,
    simplified: true,
  });
  writePng(path.join(process.cwd(), 'public', `favicon-${size}x${size}.png`), canvas);
  console.log(`✅ Generated favicon-${size}x${size}.png`);
});

const brandIconSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="512" height="512" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="SmartStyle brand icon">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#050813"/>
      <stop offset="0.55" stop-color="#130b2d"/>
      <stop offset="1" stop-color="#211047"/>
    </linearGradient>
    <linearGradient id="ringOuter" x1="0" y1="100" x2="100" y2="0" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#9333ea"/>
      <stop offset="0.65" stop-color="#c084fc"/>
      <stop offset="1" stop-color="rgba(192,132,252,0)"/>
    </linearGradient>
    <linearGradient id="ringMiddle" x1="100" y1="0" x2="0" y2="100" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#9333ea"/>
      <stop offset="0.65" stop-color="#c084fc"/>
      <stop offset="1" stop-color="rgba(192,132,252,0)"/>
    </linearGradient>
    <linearGradient id="ringInner" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#9333ea"/>
      <stop offset="0.65" stop-color="#c084fc"/>
      <stop offset="1" stop-color="rgba(192,132,252,0)"/>
    </linearGradient>
    <radialGradient id="glow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(50 50) rotate(90) scale(40)">
      <stop offset="0" stop-color="rgba(192,132,252,0.34)"/>
      <stop offset="1" stop-color="rgba(192,132,252,0)"/>
    </radialGradient>
  </defs>
  <rect x="0" y="0" width="100" height="100" rx="22" fill="url(#bg)"/>
  <circle cx="50" cy="50" r="40" fill="url(#glow)"/>
  <path d="M 93 50 A 43 43 0 1 1 92.5 43" stroke="url(#ringOuter)" stroke-width="2" stroke-linecap="round" opacity="0.3"/>
  <path d="M 83 59 A 34 34 0 1 1 42 16" stroke="url(#ringMiddle)" stroke-width="2.4" stroke-linecap="round" opacity="0.95"/>
  <path d="M 73 40 A 27 27 0 1 1 39 23" stroke="url(#ringInner)" stroke-width="2.7" stroke-linecap="round" opacity="0.98"/>
  <text x="50" y="52" text-anchor="middle" dominant-baseline="middle" fill="#FFFFFF" font-family="Space Grotesk, Sora, Avenir Next, sans-serif" font-size="34" font-weight="700" letter-spacing="1">SS</text>
</svg>
`;

fs.writeFileSync(path.join(iconsDir, 'brand-icon.svg'), brandIconSvg);
console.log('✅ Generated brand-icon.svg');

console.log('\n🎉 All unified brand icons generated successfully!');
