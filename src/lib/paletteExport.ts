/**
 * Client-side Palette Export Utilities
 * Generates visual palette images, copy-all actions, and shareable formats
 * No external services or tracking - pure frontend implementation
 */

export interface PaletteColor {
  hex: string;
  rgb: string;
  name?: string;
  label: string;
}

export interface PaletteData {
  inputColor: PaletteColor;
  matches: PaletteColor[];
  harmonyType: string;
}

/**
 * Generate a beautiful palette image using Canvas API
 */
export function generatePaletteImage(
  palette: PaletteData,
  format: 'horizontal' | 'grid' | 'swatch' = 'horizontal'
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }

      const allColors = [palette.inputColor, ...palette.matches];
      const harmonyText = `${palette.harmonyType.replace('_', ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')} Harmony`;
      
      if (format === 'horizontal') {
        // Horizontal palette strip
        const width = 1200;
        const height = 400;
        canvas.width = width;
        canvas.height = height;
        
        // Background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        
        // Title
        ctx.fillStyle = '#1f2937';
        ctx.font = 'bold 28px system-ui, -apple-system, sans-serif';
        ctx.fillText('Color Palette', 40, 60);
        
        ctx.font = '18px system-ui, -apple-system, sans-serif';
        ctx.fillStyle = '#6b7280';
        ctx.fillText(harmonyText, 40, 90);
        
        // Color swatches
        const colorWidth = (width - 80) / allColors.length;
        const colorHeight = 200;
        const startY = 120;
        
        allColors.forEach((color, index) => {
          const x = 40 + (index * colorWidth);
          
          // Color rectangle
          ctx.fillStyle = color.hex;
          ctx.fillRect(x, startY, colorWidth - 10, colorHeight);
          
          // Color info
          ctx.fillStyle = '#1f2937';
          ctx.font = 'bold 14px system-ui, -apple-system, sans-serif';
          const labelText = index === 0 ? 'Base Color' : color.label;
          ctx.fillText(labelText, x, startY + colorHeight + 30);
          
          if (color.name) {
            ctx.font = '12px system-ui, -apple-system, sans-serif';
            ctx.fillStyle = '#6b7280';
            ctx.fillText(color.name, x, startY + colorHeight + 50);
          }
          
          ctx.font = '11px monospace';
          ctx.fillText(color.hex, x, startY + colorHeight + 68);
        });
        
      } else if (format === 'grid') {
        // Grid layout with larger swatches
        const cols = 4;
        const rows = Math.ceil(allColors.length / cols);
        const swatchSize = 180;
        const padding = 20;
        const headerHeight = 120;
        
        canvas.width = (swatchSize * cols) + (padding * (cols + 1));
        canvas.height = headerHeight + (swatchSize * rows) + (padding * (rows + 1));
        
        // Background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Title
        ctx.fillStyle = '#1f2937';
        ctx.font = 'bold 32px system-ui, -apple-system, sans-serif';
        ctx.fillText('Color Palette', padding, 50);
        
        ctx.font = '18px system-ui, -apple-system, sans-serif';
        ctx.fillStyle = '#6b7280';
        ctx.fillText(harmonyText, padding, 85);
        
        // Color grid
        allColors.forEach((color, index) => {
          const col = index % cols;
          const row = Math.floor(index / cols);
          const x = padding + (col * (swatchSize + padding));
          const y = headerHeight + (row * (swatchSize + padding));
          
          // Color square
          ctx.fillStyle = color.hex;
          ctx.fillRect(x, y, swatchSize, swatchSize);
          
          // Color name overlay
          ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
          ctx.fillRect(x, y + swatchSize - 60, swatchSize, 60);
          
          ctx.fillStyle = '#1f2937';
          ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
          const label = index === 0 ? 'Base' : color.label;
          ctx.fillText(label, x + 10, y + swatchSize - 40);
          
          if (color.name) {
            ctx.font = '11px system-ui, -apple-system, sans-serif';
            ctx.fillStyle = '#4b5563';
            ctx.fillText(color.name, x + 10, y + swatchSize - 25);
          }
          
          ctx.font = '10px monospace';
          ctx.fillText(color.hex, x + 10, y + swatchSize - 10);
        });
        
      } else if (format === 'swatch') {
        // Circular swatches with info
        const swatchSize = 160;
        const itemsPerRow = 3;
        const rows = Math.ceil(allColors.length / itemsPerRow);
        const padding = 40;
        const headerHeight = 140;
        
        canvas.width = (swatchSize * itemsPerRow) + (padding * (itemsPerRow + 1));
        canvas.height = headerHeight + (swatchSize * rows) + (padding * rows) + 100;
        
        // Background with gradient
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, '#f9fafb');
        gradient.addColorStop(1, '#f3f4f6');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Title
        ctx.fillStyle = '#1f2937';
        ctx.font = 'bold 36px system-ui, -apple-system, sans-serif';
        ctx.fillText('Color Palette', padding, 60);
        
        ctx.font = '20px system-ui, -apple-system, sans-serif';
        ctx.fillStyle = '#6b7280';
        ctx.fillText(harmonyText, padding, 95);
        
        // Color swatches
        allColors.forEach((color, index) => {
          const col = index % itemsPerRow;
          const row = Math.floor(index / itemsPerRow);
          const centerX = padding + (col * swatchSize) + (swatchSize / 2) + (col * padding);
          const centerY = headerHeight + (row * swatchSize) + (swatchSize / 2) + (row * padding);
          
          // Circle shadow
          ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
          ctx.beginPath();
          ctx.arc(centerX + 4, centerY + 4, 50, 0, Math.PI * 2);
          ctx.fill();
          
          // Color circle
          ctx.fillStyle = color.hex;
          ctx.beginPath();
          ctx.arc(centerX, centerY, 50, 0, Math.PI * 2);
          ctx.fill();
          
          // Info below
          ctx.fillStyle = '#1f2937';
          ctx.font = 'bold 14px system-ui, -apple-system, sans-serif';
          ctx.textAlign = 'center';
          const label = index === 0 ? 'Base Color' : color.label;
          ctx.fillText(label, centerX, centerY + 75);
          
          if (color.name) {
            ctx.font = '12px system-ui, -apple-system, sans-serif';
            ctx.fillStyle = '#4b5563';
            ctx.fillText(color.name, centerX, centerY + 92);
          }
          
          ctx.font = '11px monospace';
          ctx.fillStyle = '#6b7280';
          ctx.fillText(color.hex, centerX, centerY + 108);
          
          ctx.textAlign = 'left'; // Reset
        });
      }
      
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to generate image'));
        }
      }, 'image/png');
      
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Download the generated palette image
 */
export async function downloadPaletteImage(
  palette: PaletteData,
  format: 'horizontal' | 'grid' | 'swatch' = 'horizontal',
  filename?: string
): Promise<void> {
  const blob = await generatePaletteImage(palette, format);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `color-palette-${Date.now()}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Copy all colors in various formats
 */
export function copyAllColors(
  palette: PaletteData,
  format: 'hex' | 'rgb' | 'css' | 'json' | 'tailwind'
): string {
  const allColors = [palette.inputColor, ...palette.matches];
  
  switch (format) {
    case 'hex':
      return allColors.map(c => c.hex).join(', ');
      
    case 'rgb':
      return allColors.map(c => c.rgb).join(', ');
      
    case 'css':
      return allColors.map((c, i) => 
        `--color-${i === 0 ? 'base' : c.label.toLowerCase().replace(/\s+/g, '-')}: ${c.hex};`
      ).join('\n');
      
    case 'json':
      return JSON.stringify({
        name: `${palette.harmonyType} Palette`,
        colors: allColors.map((c, i) => ({
          name: i === 0 ? 'base' : c.label,
          displayName: c.name || c.label,
          hex: c.hex,
          rgb: c.rgb,
        })),
      }, null, 2);
      
    case 'tailwind':
      return allColors.map((c, i) => 
        `'${i === 0 ? 'base' : c.label.toLowerCase().replace(/\s+/g, '-')}': '${c.hex}',`
      ).join('\n');
      
    default:
      return allColors.map(c => c.hex).join(', ');
  }
}

/**
 * Generate a shareable text representation
 */
export function generateShareableText(palette: PaletteData): string {
  const allColors = [palette.inputColor, ...palette.matches];
  const harmonyName = palette.harmonyType.replace('_', ' ').split(' ').map(w => 
    w.charAt(0).toUpperCase() + w.slice(1)
  ).join(' ');
  
  let text = `🎨 ${harmonyName} Color Palette\n\n`;
  text += `Base Color: ${palette.inputColor.name || palette.inputColor.hex}\n`;
  text += `${palette.inputColor.hex}\n\n`;
  text += `Matching Colors:\n`;
  
  palette.matches.forEach((color, i) => {
    text += `${i + 1}. ${color.label}`;
    if (color.name) text += ` (${color.name})`;
    text += `\n   ${color.hex}\n`;
  });
  
  text += `\nCreated with SmartStyle Color-Match`;
  
  return text;
}

/**
 * Copy palette to clipboard in user-friendly format
 */
export async function copyPaletteToClipboard(
  palette: PaletteData,
  format: 'hex' | 'rgb' | 'css' | 'json' | 'tailwind' | 'text' = 'text'
): Promise<void> {
  const content = format === 'text' 
    ? generateShareableText(palette)
    : copyAllColors(palette, format);
  
  await navigator.clipboard.writeText(content);
}

/**
 * Generate a data URL for inline preview
 */
export async function generatePaletteDataURL(
  palette: PaletteData,
  format: 'horizontal' | 'grid' | 'swatch' = 'horizontal'
): Promise<string> {
  const blob = await generatePaletteImage(palette, format);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
