self.addEventListener('message', async (e) => {
  const { imageDataUrl } = e.data;
  
  try {
    // Create an OffscreenCanvas for faster processing
    const img = await createImageBitmap(await (await fetch(imageDataUrl)).blob());
    
    // Resize to max 400x400 for faster processing
    const maxSize = 400;
    let width = img.width;
    let height = img.height;
    
    if (width > maxSize || height > maxSize) {
      if (width > height) {
        height = (height / width) * maxSize;
        width = maxSize;
      } else {
        width = (width / height) * maxSize;
        height = maxSize;
      }
    }
    
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, width, height);
    
    // Get image data
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    
    // Simple color extraction (sampling every 10th pixel for speed)
    const colorMap = new Map();
    
    for (let i = 0; i < data.length; i += 40) { // Sample every 10th pixel (4 bytes per pixel)
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      
      // Skip transparent and very dark/bright pixels
      if (a < 128 || (r < 20 && g < 20 && b < 20) || (r > 235 && g > 235 && b > 235)) {
        continue;
      }
      
      // Skip skin tones (basic check)
      const isSkin = (r > 95 && g > 40 && b > 20) && 
                     (Math.max(r, g, b) - Math.min(r, g, b) > 15) &&
                     (Math.abs(r - g) > 15) && (r > g) && (r > b);
      
      if (isSkin) continue;
      
      // Quantize colors (group similar colors)
      const rBin = Math.round(r / 32) * 32;
      const gBin = Math.round(g / 32) * 32;
      const bBin = Math.round(b / 32) * 32;
      const key = `${rBin},${gBin},${bBin}`;
      
      colorMap.set(key, (colorMap.get(key) || 0) + 1);
    }
    
    // Get top colors
    const sortedColors = Array.from(colorMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 7)
      .map(([key]) => {
        const [r, g, b] = key.split(',').map(Number);
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
      });
    
    self.postMessage({ success: true, colors: sortedColors });
  } catch (error) {
    self.postMessage({ success: false, error: error.message });
  }
});
