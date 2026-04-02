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

// Generate icons
sizes.forEach(size => {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const center = size / 2;

  // Background matches auth page mood.
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, '#050813');
  gradient.addColorStop(0.55, '#130b2d');
  gradient.addColorStop(1, '#211047');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  // Rounded mask for icon corners.
  ctx.globalCompositeOperation = 'destination-in';
  ctx.beginPath();
  const radius = size * 0.22;
  ctx.moveTo(radius, 0);
  ctx.lineTo(size - radius, 0);
  ctx.quadraticCurveTo(size, 0, size, radius);
  ctx.lineTo(size, size - radius);
  ctx.quadraticCurveTo(size, size, size - radius, size);
  ctx.lineTo(radius, size);
  ctx.quadraticCurveTo(0, size, 0, size - radius);
  ctx.lineTo(0, radius);
  ctx.quadraticCurveTo(0, 0, radius, 0);
  ctx.closePath();
  ctx.fill();

  ctx.globalCompositeOperation = 'source-over';

  // Ambient glow behind rings.
  const glow = ctx.createRadialGradient(center, center, size * 0.12, center, center, size * 0.48);
  glow.addColorStop(0, 'rgba(192,132,252,0.34)');
  glow.addColorStop(1, 'rgba(192,132,252,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(center, center, size * 0.48, 0, Math.PI * 2);
  ctx.fill();

  // Three signature SS rings inspired by AnimatedLogo.
  const outerGradient = createRingGradient(ctx, size, 0, 1, 1, 0);
  const middleGradient = createRingGradient(ctx, size, 1, 0, 0, 1);
  const innerGradient = createRingGradient(ctx, size, 0, 0, 1, 1);

  drawRingArc(ctx, center, size * 0.44, size * 0.02, -12, 330, outerGradient, 0.3);
  drawRingArc(ctx, center, size * 0.36, size * 0.024, 14, 250, middleGradient, 0.95);
  drawRingArc(ctx, center, size * 0.28, size * 0.027, -32, 228, innerGradient, 0.98);

  // Center SS monogram.
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `700 ${size * 0.34}px "Space Grotesk", "Sora", "Avenir Next", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('SS', center, center + size * 0.012);

  // Save the image
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(path.join(iconsDir, `icon-${size}x${size}.png`), buffer);
  console.log(`✅ Generated icon-${size}x${size}.png`);
});

console.log('\n🎉 All PWA icons generated successfully!');
