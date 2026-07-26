/**
 * Client-Side Deep Learning Analysis via MediaPipe Tasks Vision
 *
 * PRIVACY GUARANTEE: All processing runs entirely in the browser.
 * No images or personal data ever leave the user's device.
 *
 * Uses three MediaPipe models (lazy-loaded on first use):
 * - Selfie Segmentation (~2MB): separates person from background
 * - Face Landmarker (~5MB): 468 facial landmarks → face shape classification
 * - Pose Landmarker (~3MB): 33 body keypoints → body type estimation
 *
 * Models are loaded from Google's CDN and cached by the browser.
 */

// ---------- Types ----------

export type FaceShape = 'oval' | 'round' | 'square' | 'heart' | 'oblong';

export interface BodyAnalysis {
  bodyType: string;        // "athletic", "slim", "average", "broad"
  shoulderWidth: string;   // "narrow", "average", "broad"
  torsoLength: string;     // "short", "average", "long"
  proportions: string;     // human-readable summary
}

export interface DeepAnalysisResult {
  /** Binary mask – person pixels are white, background is black */
  segmentationMask: ImageData | null;
  /** Classified face shape from 468 landmarks */
  faceShape: FaceShape | null;
  /** Body proportions from 33 pose keypoints */
  bodyAnalysis: BodyAnalysis | null;
  /** Detected upper/lower body dominant colour names */
  regionColors: { upper: string | null; lower: string | null } | null;
  /** Overall confidence 0-100 */
  confidence: number;
  /** Per-stage timing (ms) for diagnostics */
  timing: { segmentation: number; face: number; pose: number; total: number };
}

// ---------- CDN paths ----------

const WASM_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';

const MODEL_URLS = {
  selfieSegmenter:
    'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite',
  faceLandmarker:
    'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
  poseLandmarker:
    'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
} as const;

// ---------- Singleton instances (lazy) ----------

let _vision: any = null;
let _segmenter: any = null;
let _faceLandmarker: any = null;
let _poseLandmarker: any = null;

let _initPromise: Promise<void> | null = null;
let _initFailed = false;

/**
 * Lazy-load the WASM runtime + all three models in parallel.
 * Subsequent calls return immediately once loaded.
 */
async function ensureModelsLoaded(): Promise<boolean> {
  if (_initFailed) return false;
  if (_segmenter && _faceLandmarker && _poseLandmarker) return true;

  if (_initPromise) {
    await _initPromise;
    return !_initFailed;
  }

  _initPromise = (async () => {
    try {
      const { FilesetResolver, ImageSegmenter, FaceLandmarker, PoseLandmarker } =
        await import('@mediapipe/tasks-vision');

      _vision = await FilesetResolver.forVisionTasks(WASM_CDN);

      // Load all three models in parallel
      const [segmenter, face, pose] = await Promise.all([
        ImageSegmenter.createFromOptions(_vision, {
          baseOptions: { modelAssetPath: MODEL_URLS.selfieSegmenter },
          runningMode: 'IMAGE',
          outputCategoryMask: true,
          outputConfidenceMasks: false,
        }),
        FaceLandmarker.createFromOptions(_vision, {
          baseOptions: { modelAssetPath: MODEL_URLS.faceLandmarker },
          runningMode: 'IMAGE',
          numFaces: 1,
        }),
        PoseLandmarker.createFromOptions(_vision, {
          baseOptions: { modelAssetPath: MODEL_URLS.poseLandmarker },
          runningMode: 'IMAGE',
          numPoses: 1,
        }),
      ]);

      _segmenter = segmenter;
      _faceLandmarker = face;
      _poseLandmarker = pose;
    } catch (err) {
      console.warn('[mediapipe-analysis] Failed to initialise models – falling back to heuristics', err);
      _initFailed = true;
    }
  })();

  await _initPromise;
  return !_initFailed;
}

/**
 * Yields the main thread for a brief moment to allow the browser to process UI paints,
 * preventing jank and frozen loading animations during heavy WASM inference.
 */
const yieldThread = () => new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));

// ---------- Public API ----------

/**
 * Run all three analyses on a canvas element.
 * Returns null if models cannot load (graceful degradation).
 */
export async function analyzeImageDeep(
  canvas: HTMLCanvasElement
): Promise<DeepAnalysisResult | null> {
  const t0 = performance.now();
  const ready = await ensureModelsLoaded();
  if (!ready) return null;

  let segTime = 0, faceTime = 0, poseTime = 0;

  // ── Segmentation ──
  let segmentationMask: ImageData | null = null;
  try {
    await yieldThread(); // Allow UI to paint loading state
    const tSeg = performance.now();
    const segResult = _segmenter.segment(canvas);
    segTime = performance.now() - tSeg;

    if (segResult?.categoryMask) {
      const mask = segResult.categoryMask;
      const w = mask.width;
      const h = mask.height;
      const maskData = mask.getAsUint8Array();

      // Convert category mask to RGBA ImageData (person = white, bg = transparent)
      const imgData = new ImageData(w, h);
      for (let i = 0; i < maskData.length; i++) {
        // Category 0 = background, 1+ = person
        const isPerson = maskData[i] > 0 ? 255 : 0;
        imgData.data[i * 4] = isPerson;
        imgData.data[i * 4 + 1] = isPerson;
        imgData.data[i * 4 + 2] = isPerson;
        imgData.data[i * 4 + 3] = 255;
      }
      segmentationMask = imgData;
      mask.close();
    }
  } catch (err) {
    console.warn('[mediapipe-analysis] Segmentation failed', err);
  }

  // ── Face Landmarker ──
  let faceShape: FaceShape | null = null;
  try {
    await yieldThread(); // Prevent UI lockup between models
    const tFace = performance.now();
    const faceResult = _faceLandmarker.detect(canvas);
    faceTime = performance.now() - tFace;

    if (faceResult?.faceLandmarks?.length > 0) {
      faceShape = classifyFaceShape(faceResult.faceLandmarks[0]);
    }
  } catch (err) {
    console.warn('[mediapipe-analysis] Face detection failed', err);
  }

  // ── Pose Landmarker ──
  let bodyAnalysis: BodyAnalysis | null = null;
  try {
    await yieldThread(); // Prevent UI lockup between models
    const tPose = performance.now();
    const poseResult = _poseLandmarker.detect(canvas);
    poseTime = performance.now() - tPose;

    if (poseResult?.landmarks?.length > 0) {
      bodyAnalysis = classifyBodyType(poseResult.landmarks[0]);
    }
  } catch (err) {
    console.warn('[mediapipe-analysis] Pose detection failed', err);
  }

  const total = performance.now() - t0;

  // Confidence: each stage contributes up to a third
  let confidence = 0;
  if (segmentationMask) confidence += 40;
  if (faceShape) confidence += 30;
  if (bodyAnalysis) confidence += 30;

  return {
    segmentationMask,
    faceShape,
    bodyAnalysis,
    regionColors: null, // populated later by color extraction with the mask
    confidence,
    timing: { segmentation: Math.round(segTime), face: Math.round(faceTime), pose: Math.round(poseTime), total: Math.round(total) },
  };
}

/**
 * Check whether MediaPipe models are supported in this browser.
 * Returns false for environments without WebGL / SharedArrayBuffer.
 */
export function isDeepAnalysisSupported(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    return Boolean(gl);
  } catch {
    return false;
  }
}

// ---------- Face shape classification ----------

/**
 * Classify face shape from MediaPipe's 468 facial landmarks.
 *
 * Uses key ratios:
 *  - faceWidth / faceHeight  (wide vs long)
 *  - jawWidth / foreheadWidth  (tapered jaw vs square jaw)
 *  - cheekboneWidth  (widest point)
 *
 * Landmark indices (MediaPipe canonical face mesh):
 *  - Forehead top: 10
 *  - Chin bottom: 152
 *  - Left temple: 234,  Right temple: 454
 *  - Left cheekbone: 93, Right cheekbone: 323
 *  - Left jaw: 172, Right jaw: 397
 */
function classifyFaceShape(
  landmarks: Array<{ x: number; y: number; z: number }>
): FaceShape {
  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);

  const foreheadWidth = dist(landmarks[234], landmarks[454]);
  const cheekboneWidth = dist(landmarks[93], landmarks[323]);
  const jawWidth = dist(landmarks[172], landmarks[397]);
  const faceHeight = dist(landmarks[10], landmarks[152]);

  const widthToHeight = cheekboneWidth / faceHeight;
  const jawToForehead = jawWidth / foreheadWidth;
  const jawToCheekbone = jawWidth / cheekboneWidth;

  // Classification logic based on facial proportion research
  if (widthToHeight > 0.85) {
    // Face is almost as wide as tall
    return jawToCheekbone > 0.88 ? 'square' : 'round';
  }

  if (widthToHeight < 0.62) {
    // Face is much taller than wide
    return 'oblong';
  }

  if (jawToForehead < 0.72) {
    // Jaw is significantly narrower than forehead → tapered
    return 'heart';
  }

  // Default: balanced proportions
  return 'oval';
}

// ---------- Body type classification ----------

/**
 * Classify body type from MediaPipe's 33 pose landmarks.
 *
 * Key landmarks (indices):
 *  - Left shoulder: 11, Right shoulder: 12
 *  - Left hip: 23, Right hip: 24
 *  - Left elbow: 13, Right elbow: 14
 *  - Left knee: 25, Right knee: 26
 *  - Left ankle: 27, Right ankle: 28
 */
function classifyBodyType(
  landmarks: Array<{ x: number; y: number; z: number }>
): BodyAnalysis {
  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);

  const shoulderDist = dist(landmarks[11], landmarks[12]);
  const hipDist = dist(landmarks[23], landmarks[24]);
  const shoulderMidY = (landmarks[11].y + landmarks[12].y) / 2;
  const hipMidY = (landmarks[23].y + landmarks[24].y) / 2;
  const torsoLength = Math.abs(hipMidY - shoulderMidY);

  // Use ankle to estimate full body height (normalized coordinates)
  const headY = Math.min(landmarks[11].y, landmarks[12].y) - torsoLength * 0.3;
  const ankleY = (landmarks[27].y + landmarks[28].y) / 2;
  const fullHeight = ankleY - headY;

  const shoulderToHipRatio = shoulderDist / (hipDist || 0.01);
  const torsoToHeight = torsoLength / (fullHeight || 0.01);

  // Shoulder width classification
  let shoulderWidth: string;
  if (shoulderToHipRatio > 1.35) shoulderWidth = 'broad';
  else if (shoulderToHipRatio < 1.05) shoulderWidth = 'narrow';
  else shoulderWidth = 'average';

  // Torso length classification
  let torsoLengthClass: string;
  if (torsoToHeight > 0.42) torsoLengthClass = 'long';
  else if (torsoToHeight < 0.32) torsoLengthClass = 'short';
  else torsoLengthClass = 'average';

  // Body type
  let bodyType: string;
  if (shoulderToHipRatio > 1.3 && torsoToHeight < 0.4) {
    bodyType = 'athletic';
  } else if (shoulderToHipRatio > 1.25) {
    bodyType = 'broad';
  } else if (shoulderToHipRatio < 1.05 && torsoToHeight > 0.38) {
    bodyType = 'slim';
  } else {
    bodyType = 'average';
  }

  // Human-readable summary
  const proportions = [
    `${shoulderWidth} shoulders`,
    `${torsoLengthClass} torso`,
    `${bodyType} build`,
  ].join(', ');

  return {
    bodyType,
    shoulderWidth,
    torsoLength: torsoLengthClass,
    proportions,
  };
}

/**
 * Apply segmentation mask to a canvas, zeroing out background pixels.
 * Returns a new canvas with only person pixels visible.
 * The original canvas is NOT modified.
 */
export function applySegmentationMask(
  sourceCanvas: HTMLCanvasElement,
  mask: ImageData
): HTMLCanvasElement {
  const w = sourceCanvas.width;
  const h = sourceCanvas.height;

  const outCanvas = document.createElement('canvas');
  outCanvas.width = w;
  outCanvas.height = h;
  const outCtx = outCanvas.getContext('2d', { willReadFrequently: true })!;

  // Draw original image
  outCtx.drawImage(sourceCanvas, 0, 0);
  const imgData = outCtx.getImageData(0, 0, w, h);

  // Scale mask to source dimensions if needed
  let maskPixels: Uint8ClampedArray;
  if (mask.width === w && mask.height === h) {
    maskPixels = mask.data;
  } else {
    // Resize mask via canvas
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = mask.width;
    maskCanvas.height = mask.height;
    const maskCtx = maskCanvas.getContext('2d')!;
    maskCtx.putImageData(mask, 0, 0);

    const scaledCanvas = document.createElement('canvas');
    scaledCanvas.width = w;
    scaledCanvas.height = h;
    const scaledCtx = scaledCanvas.getContext('2d')!;
    scaledCtx.drawImage(maskCanvas, 0, 0, w, h);
    maskPixels = scaledCtx.getImageData(0, 0, w, h).data;
  }

  // Zero out background pixels (mask R channel = 0 means background)
  for (let i = 0; i < imgData.data.length; i += 4) {
    if (maskPixels[i] === 0) {
      // Background pixel → make fully transparent
      imgData.data[i] = 0;
      imgData.data[i + 1] = 0;
      imgData.data[i + 2] = 0;
      imgData.data[i + 3] = 0;
    }
  }

  outCtx.putImageData(imgData, 0, 0);
  return outCanvas;
}
