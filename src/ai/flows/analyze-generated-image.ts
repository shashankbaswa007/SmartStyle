import { GoogleGenerativeAI } from '@google/generative-ai';
// NOTE: node-vibrant is imported dynamically at runtime if available. Do NOT use a static import

// Use GOOGLE_GENAI_API_KEY to match the rest of the codebase
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENAI_API_KEY!);

// Simple in-memory cache for discovered models to avoid calling ListModels frequently
let _modelDiscoveryCache: { models: string[]; expiresAt: number } | null = null;

// small helper to fetch with timeout
async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit & { timeoutMs?: number }) {
  const timeout = init?.timeoutMs ?? 6000; // default 6s
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const resp = await fetch(input, { ...(init || {}), signal: controller.signal });
    return resp;
  } finally {
    clearTimeout(id);
  }
}

// Helper: sleep for ms
const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

/**
 * Attempt Gemini generateContent with retries and exponential backoff.
 * Honors retryDelay from Google error when available.
 */
async function callGeminiWithRetry(modelName: string, payload: any, maxRetries = 3) {
  let attempt = 0;
  let lastError: any = null;

  // The generative-ai client expects a single prompt or properly shaped input.
  // Avoid passing an array containing generationConfig/inlineData directly as that
  // can cause "Unknown name 'generationConfig'" errors in some client versions.
  const promptToSend = Array.isArray(payload) ? payload[0] : payload;

  while (attempt < maxRetries) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(promptToSend);
      return result;
    } catch (err: any) {
      lastError = err;

      // If error has retry info from Google, honor it
      const retryInfo = err?.errorDetails?.find((d: any) => d['@type'] && d['@type'].includes('RetryInfo'));

      // Parse retryDelay robustly. It might be an object { seconds, nanos }, a string like '37s', or a number
      let retryDelaySec: number | null = null;
      try {
        const rd = retryInfo?.retryDelay || retryInfo;
        if (rd) {
          if (typeof rd === 'object') {
            retryDelaySec = Number(rd.seconds || rd.secs || 0) || null;
          } else if (typeof rd === 'string') {
            const m = rd.match(/(\d+)(?:s)?/);
            retryDelaySec = m ? Number(m[1]) : null;
          } else if (typeof rd === 'number') {
            retryDelaySec = Number(rd);
          }
        }
      } catch (parseErr) {
        retryDelaySec = null;
      }

      // If 429, wait and retry with exponential backoff
      const isRateLimit = err?.status === 429 || (err?.message && /Too Many Requests/i.test(err.message));

      attempt += 1;
      if (attempt >= maxRetries || !isRateLimit) {
        // No more retries or not rate-limited -> throw
        throw err;
      }

  // Use a slightly more conservative minimum backoff when server retryDelay is missing or zero.
  // Cap the backoff to 60s to avoid excessively long waits.
  const minBackoff = 2000; // 2s
  const computedBackoff = Math.min(minBackoff * 2 ** Math.max(0, attempt - 1), 60000);
  const backoffMs = typeof retryDelaySec === 'number' && retryDelaySec > 0 ? Number(retryDelaySec) * 1000 : computedBackoff;
      console.warn(`⚠️ Gemini ${modelName} rate-limited, retrying attempt ${attempt}/${maxRetries} in ${backoffMs}ms`);
      await sleep(backoffMs);
      continue;
    }
  }

  throw lastError;
}

// Legacy interface for backward compatibility
export interface GeneratedImageAnalysis {
  dominantColors: Array<{
    name: string;
    hex: string;
    percentage: number;
  }>;
  shoppingQuery: string;
  detailedDescription: string;
  // New structured data for shopping optimization
  structuredItems?: StructuredAnalysis;
}

// New structured analysis interface
export interface StructuredAnalysis {
  items: ClothingItem[];
  overallStyle: string;
  colorHarmony: string;
  targetDemographic: string;
}

export interface ClothingItem {
  itemNumber: number;
  type: string;
  gender: string;
  category: string; // top, bottom, outerwear, accessory
  style: string[];
  fit: string;
  fabric: string;
  color: string;
  pattern?: string;
  sleeveType?: string;
  neckline?: string;
  length?: string;
  occasion: string;
  season: string;
  priceRange: string;
  brandStyle?: string;
  specialFeatures: string[];
}

/**
 * NEW: Analyzes generated outfit image with structured clothing item extraction for accurate shopping
 * Uses Gemini 2.0 Flash Exp (primary) with 1.5 Flash fallback for detailed product matching
 */
export async function analyzeGeneratedImageStructured(
  imageUrl: string,
  outfitTitle: string,
  outfitDescription: string,
  outfitItems: string[],
  gender: string,
  imageBuffer?: Buffer
): Promise<StructuredAnalysis> {
  console.log('🔍 [STRUCTURED] Analyzing generated image for detailed clothing item data...');

  const STRUCTURED_PROMPT = `You are a professional fashion e-commerce product analyst with expertise in identifying clothing items for online shopping.

Your task is to analyze this generated outfit image and extract detailed, structured information about EVERY visible clothing item. Focus on accuracy and specificity to help users find similar products online.

IMPORTANT RULES:
1. Identify EACH distinct clothing item separately (shirt, pants, jacket, etc.)
2. Be highly specific about colors, fabrics, styles, and features
3. Focus on realistic, shoppable characteristics
4. Use terminology that shoppers would use in product searches
5. Consider Indian e-commerce platforms (Amazon India, Myntra, Tata CLiQ)

Context:
- Title: "${outfitTitle}"
- Description: "${outfitDescription}"
- Gender: "${gender}"
- Expected items: ${outfitItems.join(', ')}

Return a JSON object with this EXACT structure (no markdown, no extra text):
{
  "items": [
    {
      "itemNumber": 1,
      "type": "shirt|t-shirt|polo|sweater|jeans|trousers|jacket|dress|etc",
      "gender": "men|women|unisex",
      "category": "top|bottom|outerwear|dress|accessory",
      "style": ["casual", "formal", "sporty", "ethnic", "western"],
      "fit": "slim|regular|relaxed|oversized|fitted",
      "fabric": "cotton|denim|polyester|linen|wool|silk|blend",
      "color": "specific color name (e.g., navy blue, forest green, burgundy)",
      "pattern": "solid|striped|checked|printed|floral|geometric|plain",
      "sleeveType": "short sleeve|long sleeve|sleeveless|3/4 sleeve|full sleeve",
      "neckline": "crew neck|v-neck|collar|round neck|boat neck|etc",
      "length": "full length|cropped|knee length|ankle length|regular",
      "occasion": "casual|formal|party|office|outdoor|gym|ethnic",
      "season": "summer|winter|all-season|monsoon",
      "priceRange": "budget|mid-range|premium|luxury",
      "brandStyle": "minimalist|trendy|classic|streetwear|traditional",
      "specialFeatures": ["button-down", "pockets", "zipper", "embroidery", "etc"]
    }
  ],
  "overallStyle": "Description of the complete outfit aesthetic",
  "colorHarmony": "How colors work together (complementary/monochromatic/etc)",
  "targetDemographic": "Who would wear this (age range, lifestyle, preferences)"
}

Analyze the image now and return ONLY the JSON object.`;

  // Model priority: gemini-2.0-flash-exp (primary) -> gemini-1.5-flash (fallback)
  const primaryModel = 'gemini-2.0-flash-exp';
  const fallbackModel = 'gemini-1.5-flash';
  
  let lastError: Error | null = null;
  
  for (const modelName of [primaryModel, fallbackModel]) {
    try {
      console.log(`📡 Calling ${modelName} for structured analysis...`);
      
      const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENAI_API_KEY!);
      const model = genAI.getGenerativeModel({ 
        model: modelName,
        generationConfig: {
          temperature: 0.3, // Low temperature for accuracy
          maxOutputTokens: 2048,
        }
      });

      const imagePart = {
        inlineData: {
          data: imageBuffer 
            ? imageBuffer.toString('base64')
            : await (await fetch(imageUrl)).arrayBuffer().then(b => Buffer.from(b).toString('base64')),
          mimeType: 'image/png'
        }
      };

      // 15-second timeout for API call
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error(`${modelName} timeout after 15s`)), 15000)
      );

      const result = await Promise.race([
        model.generateContent([STRUCTURED_PROMPT, imagePart]),
        timeoutPromise
      ]);

      const responseText = result.response.text();
      console.log(`✅ ${modelName} response received, length: ${responseText.length}`);

      // Parse JSON response
      let structuredData: StructuredAnalysis;
      try {
        // Remove markdown code blocks if present
        const cleanJson = responseText
          .replace(/```json\s*/g, '')
          .replace(/```\s*/g, '')
          .trim();
        structuredData = JSON.parse(cleanJson);
        
        // Validate required fields
        if (!structuredData.items || !Array.isArray(structuredData.items) || structuredData.items.length === 0) {
          throw new Error('Invalid response: items array missing or empty');
        }
        
        console.log(`✅ Parsed ${structuredData.items.length} clothing items from ${modelName}`);
        return structuredData;
        
      } catch (parseErr) {
        console.error(`❌ Failed to parse JSON from ${modelName}:`, parseErr);
        console.error('Raw response:', responseText.substring(0, 500));
        throw new Error(`JSON parse failed: ${(parseErr as Error).message}`);
      }
      
    } catch (err) {
      console.error(`❌ ${modelName} failed:`, (err as Error).message);
      lastError = err as Error;
      
      // If primary failed, try fallback
      if (modelName === primaryModel) {
        console.log('⚠️ Primary model failed, trying fallback...');
        continue;
      }
    }
  }
  
  // Both models failed - throw error
  throw new Error(`Structured analysis failed: ${lastError?.message || 'Unknown error'}`);
}

/**
 * Analyzes a generated outfit image to extract accurate color palette and create shopping query
 * Uses Gemini 2.0 Flash (primary) with 1.5 Pro fallback for best performance and accuracy
 */
export async function analyzeGeneratedImage(
  imageUrl: string,
  outfitTitle: string,
  outfitDescription: string,
  outfitItems: string[],
  gender: string,
  imageBuffer?: Buffer
): Promise<GeneratedImageAnalysis> {
  console.log('🔍 Analyzing generated image for accurate colors and shopping query...');

  // NOTE: we no longer ask Gemini to produce color palettes. Gemini is used only to
  // generate an optimized shopping query and a detailed description. Color extraction
  // is handled locally via node-vibrant (or other local fallbacks) to avoid depending
  // on remote model color analysis.
  const prompt = `You are an e-commerce search specialist with deep knowledge of Indian fashion.

Given the following context, generate two outputs in JSON (no markdown):
1) "shoppingQuery": a concise 8-12 word search query optimized for Indian e-commerce product titles (start with gender, include primary item and main visible color/attributes).
2) "detailedDescription": 2-3 sentences describing visible fabrics, textures, patterns, and occasion/vibe.

Context:
- Title: "${outfitTitle}"
- Description: "${outfitDescription}"
- Gender: "${gender}"
- Item types: ${outfitItems.join(', ')}

RESPONSE FORMAT (JSON only):
{
  "shoppingQuery": "...",
  "detailedDescription": "..."
}`;

  // PERFORMANCE: We'll perform a local color extraction first and produce a fast heuristic
  // shoppingQuery/detailedDescription. By default we SKIP Gemini to keep latency low.
  // Set SMARTSTYLE_USE_GEMINI=true to enable Gemini analysis (may be slower / quota-bound).

  let tryModels: string[] = [];
  try {
    console.log('🔎 Discovering available models via REST ListModels endpoint...');
    const apiKey = process.env.GOOGLE_GENAI_API_KEY;
    // Use cached models when recent
    if (_modelDiscoveryCache && _modelDiscoveryCache.expiresAt > Date.now()) {
      tryModels = _modelDiscoveryCache.models;
      console.log('ℹ️ Using cached Gemini model list', tryModels);
    } else if (apiKey) {
      const res = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`, { timeoutMs: 4000 });
      if (res.ok) {
        const json = await res.json();
        const modelsList = Array.isArray(json) ? json : (json?.models || []);
        const geminiModels = (modelsList as any[])
          .filter((m) => (m.name || m.model || m.modelId || '').toLowerCase().includes('gemini'))
          .filter((m) => {
            const methods = m.supportedMethods || m.methods || m.supportedOperations || [];
            if (!methods) return true;
            return methods.includes('generateContent') || methods.includes('generate');
          })
          .map((m) => m.name || m.model || m.modelId || m.id)
          .filter(Boolean);

        if (geminiModels.length > 0) {
          geminiModels.sort((a: string, b: string) => (a.includes('2.0') ? -1 : 1) - (b.includes('2.0') ? -1 : 1));
          tryModels = geminiModels;
          // cache for 10 minutes
          _modelDiscoveryCache = { models: tryModels, expiresAt: Date.now() + 1000 * 60 * 10 };
          console.log('✅ Discovered Gemini models via REST:', tryModels);
        }
      } else {
        console.warn('⚠️ ListModels REST request failed with status', res.status);
      }
    } else {
      console.warn('⚠️ GOOGLE_GENAI_API_KEY missing; cannot call ListModels REST endpoint');
    }
  } catch (discErr) {
    console.warn('⚠️ Model discovery via REST failed, will fall back to default list', (discErr as any)?.message || discErr);
  }

  if (!tryModels || tryModels.length === 0) {
    tryModels = ['gemini-2.0-flash-exp', 'gemini-2.0', 'gemini-1.5-flash', 'gemini-1.5'];
  }

  // PERFORMANCE: exclude heavy flash-exp models (gemini-*-flash-exp) to avoid slow/expensive compute.
  // This skips gemini-2.0-flash-exp and similar experimental flash-exp variants.
  tryModels = tryModels.filter((m) => !/flash-exp/i.test(String(m)));

  // First: attempt local Vibrant extraction (fast, no network to Gemini)
  let dominantColors: Array<{ name: string; hex: string; percentage: number }> = [];
  try {
    console.log('🛠️ Attempting local color extraction fallback using Vibrant (dynamic import if available)...');

    // Dynamically import node-vibrant only when needed so builds without the package succeed
    let Vibrant: any = null;
    try {
      // Use eval('require') to avoid bundlers attempting to statically resolve this optional dependency
      // @ts-ignore
      const req: any = eval('require');
      const mod = req('node-vibrant');
      Vibrant = mod?.default || mod;
    } catch (impErr) {
      console.warn('⚠️ node-vibrant not available (optional dependency missing) - skipping local color extraction', (impErr as any)?.message || impErr);
    }

    if (Vibrant) {
      // Use provided imageBuffer if available (route persists image and passes buffer). Otherwise fetch image bytes for local extraction (with timeout)
      let buf: Buffer | undefined = imageBuffer;
      if (!buf) {
        const imageResp = await fetchWithTimeout(imageUrl, { timeoutMs: 5000 });
        if (imageResp.ok) {
          buf = Buffer.from(await imageResp.arrayBuffer());
        } else {
          throw new Error(`Failed to fetch image for local extraction: ${imageResp.status}`);
        }
      }

      const palette = await Vibrant.from(buf).getPalette();
      const swatches = Object.values(palette).filter(Boolean) as any[];
      const totalPopulation = swatches.reduce((sum, s) => sum + (s.getPopulation ? s.getPopulation() : (s.population || 0)), 0) || 1;

      const normalizeHex = (raw: string) => {
        if (!raw) return '#808080';
        let hex = raw.trim();
        if (!hex.startsWith('#')) hex = `#${hex}`;
        if (/^#[0-9A-Fa-f]{3}$/.test(hex)) {
          hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
        }
        if (/^#[0-9A-Fa-f]{6}$/.test(hex)) return hex.toUpperCase();
        return '#808080';
      };

      dominantColors = swatches
        .map((s) => {
          const rawHex = s.getHex ? s.getHex() : (s.hex || '#808080');
          const hex = normalizeHex(rawHex);
          const population = s.getPopulation ? s.getPopulation() : (s.population || 0);
          return {
            name: '',
            hex,
            percentage: Math.round((population / totalPopulation) * 100),
          };
        })
        .slice(0, 5);

      console.log('✅ Local color extraction complete, colors:', dominantColors.map((c) => c.hex).join(', '));
    }
  } catch (vibrantErr) {
    console.warn('⚠️ Local color extraction failed or not available:', (vibrantErr as any)?.message || vibrantErr);
  }

  // Fast heuristic generator for shoppingQuery and detailedDescription (no Gemini). This is low-latency.
  const generateLocalQuery = () => {
    const primaryItem = outfitItems && outfitItems.length ? outfitItems[0] : outfitTitle.split(' ')[0] || 'shirt';
    const primaryColor = dominantColors && dominantColors.length ? dominantColors[0].hex : '';
    const colorPhrase = primaryColor ? primaryColor : '';
    const basicQuery = `${gender} ${primaryItem} ${colorPhrase}`.trim();
    const shoppingQuery = basicQuery.split(' ').slice(0, 8).join(' ');
    const detailedDescription = `${outfitDescription || outfitTitle}. ${primaryColor ? `Dominant color: ${primaryColor}.` : ''}`;
    return { shoppingQuery, detailedDescription };
  };

  // By default, skip Gemini to keep latency low. Use SMARTSTYLE_USE_GEMINI=true to enable Gemini.
  const useGemini = String(process.env.SMARTSTYLE_USE_GEMINI || 'false').toLowerCase() === 'true';
  
  // NEW: Always attempt structured analysis for shopping optimization
  let structuredItems: StructuredAnalysis | undefined;
  try {
    console.log('🔄 Attempting structured clothing analysis for shopping optimization...');
    structuredItems = await analyzeGeneratedImageStructured(
      imageUrl,
      outfitTitle,
      outfitDescription,
      outfitItems,
      gender,
      imageBuffer
    );
    console.log(`✅ Structured analysis complete: ${structuredItems.items.length} items detected`);
  } catch (structuredErr) {
    console.error('⚠️ Structured analysis failed, shopping links will use fallback:', (structuredErr as Error).message);
    structuredItems = undefined;
  }

  let geminiShoppingQuery: string | null = null;
  let geminiDetailedDescription: string | null = null;

  if (!useGemini) {
    const local = generateLocalQuery();
    console.log('✅ Returning local analysis with', dominantColors.length, 'colors');
    return {
      dominantColors: dominantColors.length > 0 ? dominantColors : [],
      shoppingQuery: local.shoppingQuery,
      detailedDescription: local.detailedDescription,
      structuredItems, // Include structured data if available
    };
  }

  // If we reach here, the caller explicitly wants Gemini — fall through to discovery + call flow

  // At this point Gemini didn't provide usable colors. Try local Vibrant fallback if available.
    try {
      console.log('🛠️ Attempting local color extraction fallback using Vibrant (dynamic import if available)...');

      // Dynamically import node-vibrant only when needed so builds without the package succeed
      let Vibrant: any = null;
      try {
        // Use eval('require') to avoid bundlers attempting to statically resolve this optional dependency
        // @ts-ignore
        const req: any = eval('require');
        const mod = req('node-vibrant');
        Vibrant = mod?.default || mod;
      } catch (impErr) {
        console.warn('⚠️ node-vibrant not available (optional dependency missing) - skipping local color extraction', (impErr as any)?.message || impErr);
      }

      if (!Vibrant) {
        throw new Error('node-vibrant not available');
      }

      // Use provided imageBuffer if available (route persists image and passes buffer). Otherwise fetch image bytes for local extraction (with timeout)
      let buf: Buffer | undefined = imageBuffer;
      if (!buf) {
        const imageResp = await fetchWithTimeout(imageUrl, { timeoutMs: 5000 });
        if (!imageResp.ok) throw new Error(`Failed to fetch image for local extraction: ${imageResp.status}`);
        buf = Buffer.from(await imageResp.arrayBuffer());
      }

      const palette = await Vibrant.from(buf).getPalette();
    // Convert Vibrant palette to desired shape and estimate percentages by population
    const swatches = Object.values(palette).filter(Boolean) as any[];
    const totalPopulation = swatches.reduce((sum, s) => sum + (s.getPopulation ? s.getPopulation() : (s.population || 0)), 0) || 1;

    // Helper: normalize hex to full #RRGGBB uppercase
    const normalizeHex = (raw: string) => {
      if (!raw) return '#808080';
      let hex = raw.trim();
      if (!hex.startsWith('#')) hex = `#${hex}`;
      // Expand shorthand #abc -> #aabbcc
      if (/^#[0-9A-Fa-f]{3}$/.test(hex)) {
        hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
      }
      if (/^#[0-9A-Fa-f]{6}$/.test(hex)) return hex.toUpperCase();
      return '#808080';
    };

    const dominantColors = swatches
      .map((s) => {
        const rawHex = s.getHex ? s.getHex() : (s.hex || '#808080');
        const hex = normalizeHex(rawHex);
        const population = s.getPopulation ? s.getPopulation() : (s.population || 0);
        return {
          name: '', // keep name empty for local fallbacks (UI will show only swatch)
          hex,
          percentage: Math.round((population / totalPopulation) * 100),
        };
      })
      .slice(0, 5);

    const fallbackQuery = `${gender} ${outfitItems.join(' ')} ${outfitTitle} buy online India fashion`;

    console.log('✅ Local color extraction complete, colors:', dominantColors.map((c) => c.hex).join(', '));

    return {
      dominantColors,
      shoppingQuery: geminiShoppingQuery || fallbackQuery,
      detailedDescription: geminiDetailedDescription || outfitDescription,
      structuredItems, // Include structured data if available
    };
  } catch (vibrantErr) {
    console.error('⚠️ Local color extraction failed or not available:', (vibrantErr as any)?.message || vibrantErr);
    const fallbackQuery = `${gender} ${outfitItems.join(' ')} ${outfitTitle} buy online India fashion`;
    return {
      dominantColors: [],
      shoppingQuery: geminiShoppingQuery || fallbackQuery,
      detailedDescription: geminiDetailedDescription || outfitDescription,
      structuredItems, // Include structured data if available
    };
  }
}
