declare module 'canvas' {
  export interface Canvas {
    width: number;
    height: number;
    getContext(contextId: '2d'): CanvasRenderingContext2D;
    toDataURL(type?: string, quality?: any): string;
    toBuffer(type?: string): Buffer;
  }

  export interface CanvasRenderingContext2D {
    drawImage(image: any, dx: number, dy: number): void;
    drawImage(image: any, dx: number, dy: number, dw: number, dh: number): void;
    getImageData(sx: number, sy: number, sw: number, sh: number): ImageData;
  }

  export interface ImageData {
    data: Uint8ClampedArray;
    width: number;
    height: number;
  }

  export interface Image {
    src: string | Buffer;
    width: number;
    height: number;
    onload: (() => void) | null;
    onerror: ((err: Error) => void) | null;
  }

  export function createCanvas(width: number, height: number): Canvas;
  export function loadImage(src: string | Buffer): Promise<Image>;
}
