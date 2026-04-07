import fs from 'fs';
import path from 'path';
import { createCanvas, loadImage } from 'canvas';

// Create icons directory
const iconsDir = path.join(process.cwd(), 'public', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Minimal install-ready icon set.
const sizes = [192, 512];
const faviconSizes = [16, 32, 48];
const sourceSvgPath = path.join(iconsDir, 'brand-icon.svg');
const legacySizes = [72, 96, 128, 144, 152, 384];

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

function writePng(filePath, canvas) {
  fs.writeFileSync(filePath, canvas.toBuffer('image/png'));
}

async function drawFromBrandSvg(size, { rounded, iconPaddingRatio, cornerRadiusRatio }, image) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const inset = Math.round(size * iconPaddingRatio);
  const drawSize = size - inset * 2;

  ctx.clearRect(0, 0, size, size);
  ctx.drawImage(image, inset, inset, drawSize, drawSize);

  if (rounded) {
    ctx.save();
    ctx.globalCompositeOperation = 'destination-in';
    drawRoundedRectPath(ctx, 0, 0, size, size, size * cornerRadiusRatio);
    ctx.fill();
    ctx.restore();
  }

  return canvas;
}

function removeLegacyIcons() {
  for (const size of legacySizes) {
    const legacyPath = path.join(iconsDir, `icon-${size}x${size}.png`);
    if (fs.existsSync(legacyPath)) {
      fs.rmSync(legacyPath);
      console.log(`🧹 Removed legacy icon-${size}x${size}.png`);
    }
  }
}

async function main() {
  if (!fs.existsSync(sourceSvgPath)) {
    throw new Error(`Missing source icon: ${sourceSvgPath}`);
  }

  const sourceSvg = await loadImage(sourceSvgPath);

  // Generate standard PWA icons (any purpose) from shared SVG source.
  for (const size of sizes) {
    const canvas = await drawFromBrandSvg(
      size,
      {
        rounded: false,
        iconPaddingRatio: 0,
        cornerRadiusRatio: 0.22,
      },
      sourceSvg
    );
    writePng(path.join(iconsDir, `icon-${size}x${size}.png`), canvas);
    console.log(`✅ Generated icon-${size}x${size}.png`);
  }

  // Generate maskable icons with safe-zone padding from the same SVG source.
  for (const size of sizes) {
    const canvas = await drawFromBrandSvg(
      size,
      {
        rounded: false,
        iconPaddingRatio: 0.12,
        cornerRadiusRatio: 0.22,
      },
      sourceSvg
    );
    writePng(path.join(iconsDir, `icon-maskable-${size}x${size}.png`), canvas);
    console.log(`✅ Generated icon-maskable-${size}x${size}.png`);
  }

  // Generate favicon assets from the same SVG source with consistent edge padding.
  for (const size of faviconSizes) {
    const canvas = await drawFromBrandSvg(
      size,
      {
        rounded: true,
        iconPaddingRatio: 0.04,
        cornerRadiusRatio: 0.2,
      },
      sourceSvg
    );
    writePng(path.join(process.cwd(), 'public', `favicon-${size}x${size}.png`), canvas);
    console.log(`✅ Generated favicon-${size}x${size}.png`);
  }

  removeLegacyIcons();
  console.log('\n🎉 Unified brand icons generated from public/icons/brand-icon.svg');
}

main().catch((error) => {
  console.error('❌ Icon generation failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
