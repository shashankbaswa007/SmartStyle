"use client";

import * as React from "react";
import Image from "next/image";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Loader2, UploadCloud, RefreshCw, User, Camera, X, AlertCircle } from "lucide-react";
import chroma from "chroma-js";
import { motion, AnimatePresence } from "framer-motion";

import type { AnalyzeImageAndProvideRecommendationsInput, AnalyzeImageAndProvideRecommendationsOutput } from "@/ai/flows/analyze-image-and-provide-recommendations";
import saveRecommendation from '@/lib/firestoreRecommendations';
import { generateOutfitImage } from "@/ai/flows/generate-outfit-image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { getWeatherData } from "@/app/actions";
import { cn } from "@/lib/utils";
import { StyleAdvisorResults } from "./style-advisor-results";
import { auth } from "@/lib/firebase";
import { validateImageForStyleAnalysis, validateImageProperties } from "@/lib/image-validation";
import { RecommendationProgress } from './RecommendationProgress';
import { OutfitSkeletonGrid } from './OutfitCardSkeleton';

// Processing step interface
interface ProcessingStep {
  id: string;
  label: string;
  status: 'pending' | 'processing' | 'complete' | 'error';
  message?: string;
}

const genders = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "unisex", label: "Unisex" },
];

const formSchema = z.object({
  image: z
    .any()
    .refine((files) => files?.length === 1, "An image of your outfit is required.")
    .refine((files) => files?.[0]?.size <= 10000000, `Max file size is 10MB.`),
  occasion: z.string({ required_error: "Please enter an occasion." }).min(3, "Occasion must be at least 3 characters."),
  genre: z.string({ required_error: "Please enter a genre." }).min(3, "Genre must be at least 3 characters."),
  gender: z.string({ required_error: "Please select a gender." }).min(1),
});

type AnalysisRequest = Omit<AnalyzeImageAndProvideRecommendationsInput, 'previousRecommendation'>;

type PreviewStage = 'queued' | 'palette' | 'outfit_text' | 'images' | 'finalizing';

interface StagedPreviewOutfit {
  title: string;
  description: string;
  colorPalette: string[];
  imageUrl?: string | null;
}

interface StagedPreview {
  stage: PreviewStage;
  queueWaitMs?: number;
  imagesReady: number;
  totalImages: number;
  analysis: {
    feedback: string;
    highlights: string[];
    colorSuggestions: Array<{ name: string; hex: string; reason?: string }>;
    outfitRecommendations: StagedPreviewOutfit[];
    notes: string;
    imagePrompt: string;
    provider?: 'gemini' | 'groq';
  };
}

const TRUST_CUES = [
  'Based on your preferences',
  'Optimized for your occasion',
  'Balanced for color harmony',
];
const TRUST_CUES_BY_VARIANT: Record<'A' | 'B', string[]> = {
  A: TRUST_CUES,
  B: [
    'Tailored to your current style direction',
    'Matched to your occasion context',
    'Calibrated for balanced color flow',
  ],
};

const UX_VARIANT_STORAGE_PREFIX = 'smartstyle:ux-variant:';

function resolveUxVariant(userId?: string): 'A' | 'B' {
  if (typeof window === 'undefined') return 'A';
  const key = `${UX_VARIANT_STORAGE_PREFIX}${userId || 'anonymous'}`;
  const existing = window.localStorage.getItem(key);
  if (existing === 'A' || existing === 'B') return existing;

  const assigned: 'A' | 'B' = Math.random() < 0.5 ? 'A' : 'B';
  window.localStorage.setItem(key, assigned);
  return assigned;
}

function getFriendlyStageMessage(stageRaw?: string, imagesReady = 0, totalImages = 3, variant: 'A' | 'B' = 'A'): string {
  const stage = String(stageRaw || '').toLowerCase();
  if (variant === 'B') {
    if (stage === 'palette') return 'Reading your style signals...';
    if (stage === 'outfit_text') return 'Shaping your best outfit combinations...';
    if (stage === 'images') return `Rendering your look previews... (${imagesReady}/${totalImages})`;
    if (stage === 'finalizing') return 'Polishing your recommendations...';
    return 'Setting up your personalized style guidance...';
  }

  if (stage === 'palette') return 'Analyzing your style...';
  if (stage === 'outfit_text') return 'Refining outfit combinations...';
  if (stage === 'images') return `Generating visuals... (${imagesReady}/${totalImages})`;
  if (stage === 'finalizing') return 'Putting the final touches on your recommendations...';
  return 'Preparing your personalized recommendations...';
}

function getFallbackFriendlyMessage(
  fallbackSource?: string,
  cacheSource?: string,
  variant: 'A' | 'B' = 'A'
): string | null {
  const isVariantB = variant === 'B';
  if (fallbackSource === 'cache' || cacheSource === 'exact-cache-recovery') {
    return isVariantB
      ? 'Showing an instant preview while we fine-tune your updated recommendations.'
      : 'Showing a quick preview while we refine your results.';
  }
  if (fallbackSource === 'similar' || cacheSource === 'similar-recovery') {
    return isVariantB
      ? 'Using your recent style direction to keep recommendations consistent.'
      : 'Using a similar style from your recent looks.';
  }
  if (fallbackSource === 'simplified' || cacheSource === 'fallback' || cacheSource === 'timeout-fallback') {
    return isVariantB
      ? 'Showing a fast style draft now while we continue refining in the background.'
      : 'Showing a quick preview while we refine your results.';
  }
  return null;
}

function buildDemoFallbackAnalysis(): AnalyzeImageAndProvideRecommendationsOutput {
  return {
    feedback:
      'We prepared a fast demo-safe recommendation set so you can continue without interruption.',
    highlights: [
      'Keep one anchor neutral to make the look cohesive.',
      'Use one accent piece to add visual interest.',
      'Prioritize fit and layering for a polished silhouette.',
    ],
    colorSuggestions: [
      { name: 'Midnight Navy', hex: '#1E3A8A', reason: 'Adds structure and depth.' },
      { name: 'Ivory', hex: '#F8F5F0', reason: 'Balances deeper tones cleanly.' },
      { name: 'Forest Green', hex: '#166534', reason: 'Adds refined contrast.' },
      { name: 'Charcoal', hex: '#1F2937', reason: 'Reliable modern neutral.' },
      { name: 'Soft Beige', hex: '#D6C7B0', reason: 'Keeps the look warm and wearable.' },
      { name: 'Dusty Rose', hex: '#C08497', reason: 'Subtle accent option.' },
      { name: 'Slate Blue', hex: '#64748B', reason: 'Pairs well across seasons.' },
      { name: 'Warm Taupe', hex: '#8B7D6B', reason: 'Grounds brighter accents.' },
    ],
    outfitRecommendations: [
      {
        title: 'Refined Smart Casual',
        description:
          'Pair a crisp neutral top with tailored dark bottoms for a clean and modern profile. Layer with a lightweight jacket to add dimension without overcomplicating the silhouette. Finish with minimal accessories and a structured shoe for a polished everyday look.',
        colorPalette: ['#1E3A8A', '#F8F5F0', '#1F2937'],
        styleType: 'smart casual',
        occasion: 'casual outing',
        imagePrompt: 'A refined smart casual outfit with clean lines and balanced neutrals.',
        shoppingLinks: { amazon: null, tatacliq: null, myntra: null },
        isExistingMatch: true,
        items: ['Neutral shirt', 'Tailored trousers', 'Light jacket', 'Clean sneakers'],
      },
      {
        title: 'Elevated Minimal',
        description:
          'Use a monochrome base and introduce one accent color to keep the look intentional. Keep textures subtle so the outfit reads premium and effortless. Choose understated accessories to maintain a sharp, editorial finish.',
        colorPalette: ['#1F2937', '#D6C7B0', '#166534'],
        styleType: 'minimal',
        occasion: 'day event',
        imagePrompt: 'An elevated minimal outfit with monochrome base and one tasteful accent.',
        shoppingLinks: { amazon: null, tatacliq: null, myntra: null },
        isExistingMatch: true,
        items: ['Minimal top', 'Straight-fit pants', 'Accent layer', 'Leather loafers'],
      },
      {
        title: 'Contemporary Classic',
        description:
          'Blend classic cuts with contemporary color balance for a timeless result. Keep proportions balanced from top to bottom so the look feels intentional on camera. Add one textural element to create depth while preserving a clean overall presentation.',
        colorPalette: ['#64748B', '#F8F5F0', '#8B7D6B'],
        styleType: 'classic modern',
        occasion: 'smart occasion',
        imagePrompt: 'A contemporary classic outfit with balanced proportions and soft texture.',
        shoppingLinks: { amazon: null, tatacliq: null, myntra: null },
        isExistingMatch: true,
        items: ['Structured top', 'Classic bottom', 'Textured outerwear', 'Neutral footwear'],
      },
    ],
    notes: 'You can use this quick set immediately and refresh later for a fully regenerated result.',
    imagePrompt: 'Premium contemporary outfit styling with balanced colors and clean silhouette.',
    provider: 'gemini',
  };
}

interface ResultMeta {
  isFresh: boolean;
  usedFallback: boolean;
}

interface StyleAdvisorProps {
  isLimitReached?: boolean;
}

// Convert RGB to HSV for better color analysis
function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  r /= 255;
  g /= 255;
  b /= 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const diff = max - min;
  
  let h = 0;
  const s = max === 0 ? 0 : diff / max;
  const v = max;
  
  if (diff !== 0) {
    if (max === r) {
      h = ((g - b) / diff + (g < b ? 6 : 0)) / 6;
    } else if (max === g) {
      h = ((b - r) / diff + 2) / 6;
    } else {
      h = ((r - g) / diff + 4) / 6;
    }
  }
  
  return { h: h * 360, s: s * 100, v: v * 100 };
}

// Advanced skin tone detection using multiple criteria
function isSkinColor(r: number, g: number, b: number): boolean {
  // Method 1: RGB Rule-based detection (works for most skin tones)
  const rgbCheck = r > 95 && g > 40 && b > 20 &&
                   r > g && r > b &&
                   Math.max(r, g, b) - Math.min(r, g, b) > 15 &&
                   Math.abs(r - g) > 15;
  
  // Method 2: YCbCr color space check (more accurate for diverse skin tones)
  const y = 0.299 * r + 0.587 * g + 0.114 * b;
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
  
  const ycbcrCheck = cr >= 133 && cr <= 173 && cb >= 77 && cb <= 127;
  
  // Method 3: HSV check for skin tone range
  const hsv = rgbToHsv(r, g, b);
  const hsvCheck = hsv.h >= 0 && hsv.h <= 50 && hsv.s >= 0.23 * 100 && hsv.s <= 0.68 * 100;
  
  // Return true if at least 2 methods agree
  const checks = [rgbCheck, ycbcrCheck, hsvCheck].filter(Boolean).length;
  return checks >= 2;
}

// Get color name from RGB values with better accuracy
function getColorName(r: number, g: number, b: number): string {
  const hsv = rgbToHsv(r, g, b);
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  
  // Check for achromatic colors first (black, white, gray)
  if (hsv.s < 10) {
    if (luminance < 50) return 'black';
    if (luminance > 200) return 'white';
    return 'gray';
  }
  
  // Categorize by hue (color wheel)
  const hue = hsv.h;
  const sat = hsv.s;
  const val = hsv.v;
  
  // Low saturation = pastel/muted colors
  const isPastel = sat < 30;
  const isDark = val < 40;
  const isBright = val > 75 && sat > 60;
  
  let baseName = '';
  
  if (hue >= 0 && hue < 15) baseName = 'red';
  else if (hue >= 15 && hue < 45) baseName = isDark ? 'brown' : 'orange';
  else if (hue >= 45 && hue < 75) baseName = 'yellow';
  else if (hue >= 75 && hue < 150) baseName = 'green';
  else if (hue >= 150 && hue < 200) baseName = 'cyan';
  else if (hue >= 200 && hue < 260) baseName = 'blue';
  else if (hue >= 260 && hue < 300) baseName = 'purple';
  else if (hue >= 300 && hue < 330) baseName = 'magenta';
  else baseName = 'red';
  
  // Add modifiers for better descriptions
  if (isPastel) return `light ${baseName}`;
  if (isDark) return `dark ${baseName}`;
  if (isBright) return `bright ${baseName}`;
  
  return baseName;
}

/**
 * StyleAdvisor component
 * Image preloading is now handled per-card in StyleAdvisorResults.
 */

export function StyleAdvisor({ isLimitReached = false }: StyleAdvisorProps) {
  const { toast } = useToast();
  const [weather, setWeather] = React.useState<string | null>(null);
  const [isFetchingWeather, setIsFetchingWeather] = React.useState(true);
  const [analysisResult, setAnalysisResult] = React.useState<AnalyzeImageAndProvideRecommendationsOutput | null>(null);
  const [generatedImageUrls, setGeneratedImageUrls] = React.useState<string[]>([]);
  const [imageSources, setImageSources] = React.useState<('gemini' | 'pollinations' | 'placeholder')[]>([]);
  const [recommendationId, setRecommendationId] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [allContentReady, setAllContentReady] = React.useState(false);
  const [showResults, setShowResults] = React.useState(false);
  const [processingSteps, setProcessingSteps] = React.useState<ProcessingStep[]>([]);
  const [loadingMessage, setLoadingMessage] = React.useState("Analyzing Your Style...");
  const [previewImage, setPreviewImage] = React.useState<string | null>(null);
  const [lastAnalysisRequest, setLastAnalysisRequest] = React.useState<AnalysisRequest | null>(null);
  const [showCamera, setShowCamera] = React.useState(false);
  const [isCameraActive, setIsCameraActive] = React.useState(false);
  const [extractedData, setExtractedData] = React.useState<{ skinTone: string; dressColors: string; colorPalette?: string[] } | null>(null);
  const [isValidatingImage, setIsValidatingImage] = React.useState(false);
  const [imageValidationError, setImageValidationError] = React.useState<string | null>(null);
  const [progressStage, setProgressStage] = React.useState(0);
  const [stagedPreview, setStagedPreview] = React.useState<StagedPreview | null>(null);
  const [fallbackMessage, setFallbackMessage] = React.useState<string | null>(null);
  const [completionGlow, setCompletionGlow] = React.useState(false);
  const [uxVariant, setUxVariant] = React.useState<'A' | 'B'>('A');
  const [resultMeta, setResultMeta] = React.useState<ResultMeta | null>(null);
  const [recommendCooldownUntil, setRecommendCooldownUntil] = React.useState<number | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const analysisAbortRef = React.useRef<AbortController | null>(null);
  const activeRequestIdRef = React.useRef(0);
  const isMountedRef = React.useRef(true);
  const submitInFlightRef = React.useRef(false);


  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      occasion: "",
      genre: "",
      gender: "",
    },
  });

  // Helper function to update processing steps
  const updateStep = React.useCallback((stepId: string, status: ProcessingStep['status'], message?: string) => {
    setProcessingSteps(prev => {
      const existingStep = prev.find(s => s.id === stepId);
      if (existingStep) {
        return prev.map(s => s.id === stepId ? { ...s, status, message: message || s.message } : s);
      }
      // Add new step if it doesn't exist
      return [...prev, { id: stepId, label: message || stepId, status, message }];
    });
  }, []);

  // Initialize processing steps
  const initializeProcessingSteps = React.useCallback(() => {
    setProcessingSteps([
      { id: 'extract', label: 'Extracting colors from image', status: 'pending' },
      { id: 'analyze', label: 'AI analyzing your style preferences', status: 'pending' },
      { id: 'generate', label: 'Generating 3 outfit images', status: 'pending' },
      { id: 'enhance', label: 'Analyzing generated images for accurate colors', status: 'pending' },
      { id: 'search', label: 'Finding best shopping links', status: 'pending' },
      { id: 'finalize', label: 'Loading and verifying all content', status: 'pending' },
    ]);
  }, []);

  React.useEffect(() => {
    isMountedRef.current = true;
    // Request browser location for weather
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          
          
          const weatherData = await getWeatherData({ lat, lon });
          
          setWeather(weatherData);
        } catch (error) {
          setWeather("Clear skies, around 25°C");
          toast({
            variant: "default",
            title: "Could not fetch weather",
            description: "Using default weather.",
          });
        } finally {
          if (isMountedRef.current) {
            setIsFetchingWeather(false);
          }
        }
      },
      (geoError) => {
        
        setWeather("Clear skies, around 25°C");
        toast({
          variant: "default",
          title: "Location access needed",
          description: "Enable location access in your browser for weather-based recommendations. Using default weather for now.",
        });
        if (isMountedRef.current) {
          setIsFetchingWeather(false);
        }
      }
    );
  }, [toast]);

  React.useEffect(() => {
    const uid = auth.currentUser?.uid || 'anonymous';
    setUxVariant(resolveUxVariant(uid));
  }, []);

  // Cleanup camera and in-flight analysis on unmount
  React.useEffect(() => {
    return () => {
      isMountedRef.current = false;
      analysisAbortRef.current?.abort();
      stopCamera();
    };
  }, []);

  React.useEffect(() => {
    if (!showResults || !analysisResult || !allContentReady) return;

    void fetch('/api/recommend/interaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ variant: uxVariant, event: 'results_visible' }),
    }).catch(() => {
      // Interaction telemetry is best effort.
    });
  }, [showResults, analysisResult, allContentReady, uxVariant]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user' } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setIsCameraActive(true);
        setShowCamera(true);
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Camera Access Error",
        description: "Unable to access camera. Please check permissions.",
      });
    }
  };

  const capturePhoto = React.useCallback(async () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const imageDataUrl = canvas.toDataURL('image/jpeg', 0.8);
        
        // Stop camera first
        stopCamera();
        setShowCamera(false);
        
        // Validate the captured image
        setIsValidatingImage(true);
        setLoadingMessage("Validating captured photo...");
        
        try {
          const validation = await validateImageForStyleAnalysis(imageDataUrl);

          // Only accept images with confidence strictly greater than 80
          const MIN_CONFIDENCE = 80;
          if (!validation.confidence || validation.confidence <= MIN_CONFIDENCE) {
            const msg = validation.message || `Image confidence too low (${validation.confidence ?? 0}%). Please upload a clearer photo.`;
            setImageValidationError(msg);
            toast({
              variant: "destructive",
              title: "Photo Validation Failed",
              description: msg,
            });
            return;
          }

          // Image passes the stricter confidence gate - proceed
          setPreviewImage(imageDataUrl);
          setImageValidationError(null);

          toast({
            title: "Photo Captured ✓",
            description: `Ready for style analysis! (Confidence: ${validation.confidence}%)`,
          });
          
          // Extract colors immediately
          const extracted = extractColorsFromCanvas();
          setExtractedData(extracted);
          
          // Convert data URL to File object for form validation
          fetch(imageDataUrl)
            .then(res => res.blob())
            .then(blob => {
              const file = new File([blob], "camera-capture.jpg", { type: "image/jpeg" });
              const dataTransfer = new DataTransfer();
              dataTransfer.items.add(file);
              form.setValue('image', dataTransfer.files);
            });
        } catch (error) {
          // On error, allow to proceed
          setPreviewImage(imageDataUrl);
          
          const extracted = extractColorsFromCanvas();
          setExtractedData(extracted);
          
          fetch(imageDataUrl)
            .then(res => res.blob())
            .then(blob => {
              const file = new File([blob], "camera-capture.jpg", { type: "image/jpeg" });
              const dataTransfer = new DataTransfer();
              dataTransfer.items.add(file);
              form.setValue('image', dataTransfer.files);
            });
        } finally {
          setIsValidatingImage(false);
        }
      }
    }
  }, [form, toast]);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setPreviewImage(null);
      setExtractedData(null);
      setImageValidationError(null);
      return;
    }

    // Client-side validation
    const propertyValidation = validateImageProperties(file);
    if (!propertyValidation.isValid) {
      setImageValidationError(propertyValidation.message);
      toast({
        variant: "destructive",
        title: "Invalid Image",
        description: propertyValidation.message,
      });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const imgSrc = reader.result as string;
      setPreviewImage(imgSrc);
      setImageValidationError(null);

      // Server-side validation with Gemini
      setIsValidatingImage(true);
      setLoadingMessage("Validating image...");

      try {
        const validation = await validateImageForStyleAnalysis(imgSrc);

        // Only accept images with confidence strictly greater than 80
        const MIN_CONFIDENCE = 80;
        if (!validation.confidence || validation.confidence <= MIN_CONFIDENCE) {
          const msg = validation.message || `Image confidence too low (${validation.confidence ?? 0}%). Please upload a clearer photo.`;
          setImageValidationError(msg);
          setPreviewImage(null); // Clear the preview
          toast({
            variant: "destructive",
            title: "Image Validation Failed",
            description: msg,
          });
          return;
        }

        toast({
          title: "Image Validated ✓",
          description: `Ready for style analysis! (Confidence: ${validation.confidence}%)`,
        });

        // Extract colors immediately for preview
        const img = document.createElement('img');
        img.onload = () => {
          if (canvasRef.current) {
            const canvas = canvasRef.current;
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0);
              const extracted = extractColorsFromCanvas();
              setExtractedData(extracted);
            }
          }
        };
        img.src = imgSrc;
      } catch (error) {
        // Allow to proceed on validation error
        toast({
          variant: "default",
          title: "Validation Skipped",
          description: "Proceeding with analysis...",
        });

        // Extract colors anyway
        const img = document.createElement('img');
        img.onload = () => {
          if (canvasRef.current) {
            const canvas = canvasRef.current;
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0);
              const extracted = extractColorsFromCanvas();
              setExtractedData(extracted);
            }
          }
        };
        img.src = imgSrc;
      } finally {
        setIsValidatingImage(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setPreviewImage(null);
    setExtractedData(null);
    setImageValidationError(null);
    form.setValue('image', undefined);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const resetForm = () => {
    form.reset();
    setPreviewImage(null);
    setAnalysisResult(null);
    setStagedPreview(null);
    setAllContentReady(false);
    setShowResults(false);
    setProcessingSteps([]);
    setLastAnalysisRequest(null);
    setGeneratedImageUrls([]);
    setImageSources([]);
    setFallbackMessage(null);
    setCompletionGlow(false);
    setResultMeta(null);
  };

  const extractColorsFromCanvas = (): { skinTone: string; dressColors: string; colorPalette?: string[] } => {
    const canvas = canvasRef.current;
    if (!canvas) return { skinTone: "not detected", dressColors: "not detected" };

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return { skinTone: "not detected", dressColors: "not detected" };

    console.time('colorExtraction');
    
    // ═══════════════════════════════════════════════════════════════════
    // STAGE 0: Lightweight preprocessing
    // Downscale → 3×3 Gaussian blur (gray-world applied after skin detect)
    // ═══════════════════════════════════════════════════════════════════
    const MAX_DIM = 256;
    const origW = canvas.width;
    const origH = canvas.height;
    const scale = Math.min(1, MAX_DIM / Math.max(origW, origH));
    const width = Math.round(origW * scale);
    const height = Math.round(origH * scale);

    // Scale sampling rates proportionally so counts stay consistent
    const skinSampleRate = Math.max(2, Math.round(12 * scale));
    const clothingSampleRate = Math.max(2, Math.round(10 * scale));
    const edgeStride = Math.max(1, Math.round(4 * scale));

    // Downscale via an offscreen canvas for anti-aliased resampling
    const workCanvas = document.createElement('canvas');
    workCanvas.width = width;
    workCanvas.height = height;
    const workCtx = workCanvas.getContext('2d', { willReadFrequently: true })!;
    workCtx.drawImage(canvas, 0, 0, width, height);
    const imageData = workCtx.getImageData(0, 0, width, height);
    const data = imageData.data;

    // 3×3 Gaussian blur (σ≈0.85, kernel: [1 2 1; 2 4 2; 1 2 1] / 16)
    const blurred = new Uint8ClampedArray(data.length);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const oi = (y * width + x) * 4;
        if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
          blurred[oi] = data[oi]; blurred[oi + 1] = data[oi + 1];
          blurred[oi + 2] = data[oi + 2]; blurred[oi + 3] = data[oi + 3];
          continue;
        }
        for (let ch = 0; ch < 3; ch++) {
          const tl = data[((y-1)*width+(x-1))*4+ch], tc = data[((y-1)*width+x)*4+ch], tr = data[((y-1)*width+(x+1))*4+ch];
          const ml = data[(y*width+(x-1))*4+ch],                                       mr = data[(y*width+(x+1))*4+ch];
          const bl_ = data[((y+1)*width+(x-1))*4+ch], bc = data[((y+1)*width+x)*4+ch], br = data[((y+1)*width+(x+1))*4+ch];
          blurred[oi + ch] = (tl + 2*tc + tr + 2*ml + 4*data[oi+ch] + 2*mr + bl_ + 2*bc + br) >> 4;
        }
        blurred[oi + 3] = data[oi + 3];
      }
    }

    // Write blurred data back (gray-world applied after skin detection)
    for (let i = 0; i < data.length; i++) data[i] = blurred[i];
    
    // ═══════════════════════════════════════════════════════════════════
    // STAGE 1: Fast skin detection (preserved voting system)
    // Runs on blurred-only data so skin thresholds remain accurate.
    // ═══════════════════════════════════════════════════════════════════
    const skinPixels: { x: number; y: number; r: number; g: number; b: number }[] = [];
    
    for (let y = 0; y < height; y += skinSampleRate) {
      for (let x = 0; x < width; x += skinSampleRate) {
        const idx = (y * width + x) * 4;
        const r = data[idx], g = data[idx + 1], b = data[idx + 2];
        if (isSkinColor(r, g, b)) {
          skinPixels.push({ x, y, r, g, b });
        }
      }
    }
    
    // ═══════════════════════════════════════════════════════════════════
    // STAGE 1b: Gray-world color normalization
    // Applied after skin detection to preserve skin color thresholds,
    // but before clothing sampling for illumination-stable clustering.
    // ═══════════════════════════════════════════════════════════════════
    {
      let sumR = 0, sumG = 0, sumB = 0;
      const totalPx = width * height;
      for (let i = 0; i < data.length; i += 4) {
        sumR += data[i]; sumG += data[i + 1]; sumB += data[i + 2];
      }
      const avgR = sumR / totalPx, avgG = sumG / totalPx, avgB = sumB / totalPx;
      const avgGray = (avgR + avgG + avgB) / 3;
      // Clamp scale factors to prevent extreme corrections with colored backgrounds
      const gwScaleR = avgR > 0 ? Math.min(1.2, Math.max(0.8, avgGray / avgR)) : 1;
      const gwScaleG = avgG > 0 ? Math.min(1.2, Math.max(0.8, avgGray / avgG)) : 1;
      const gwScaleB = avgB > 0 ? Math.min(1.2, Math.max(0.8, avgGray / avgB)) : 1;
      for (let i = 0; i < data.length; i += 4) {
        data[i]     = Math.min(255, Math.max(0, Math.round(data[i] * gwScaleR)));
        data[i + 1] = Math.min(255, Math.max(0, Math.round(data[i + 1] * gwScaleG)));
        data[i + 2] = Math.min(255, Math.max(0, Math.round(data[i + 2] * gwScaleB)));
      }
    }
    
    // ═══════════════════════════════════════════════════════════════════
    // STAGE 2: DBSCAN person localization
    // Clusters skin pixels spatially; largest cluster = person center.
    // Eliminates background skin-colored objects (furniture, walls).
    // ═══════════════════════════════════════════════════════════════════
    let personCenterX = width / 2;
    let personCenterY = height / 2;
    
    if (skinPixels.length > 20) {
      const eps = Math.min(width, height) * 0.08; // neighbourhood radius ≈ 8% of image
      const minPts = 3;
      const labels = new Int16Array(skinPixels.length).fill(-1); // -1 = unvisited
      let clusterId = 0;

      for (let i = 0; i < skinPixels.length; i++) {
        if (labels[i] !== -1) continue;
        // Region query — find neighbours within eps
        const seeds: number[] = [];
        for (let j = 0; j < skinPixels.length; j++) {
          const dx = skinPixels[i].x - skinPixels[j].x;
          const dy = skinPixels[i].y - skinPixels[j].y;
          if (dx * dx + dy * dy <= eps * eps) seeds.push(j);
        }
        if (seeds.length < minPts) { labels[i] = -2; continue; } // noise
        labels[i] = clusterId;
        const queue = [...seeds];
        let qi = 0;
        while (qi < queue.length) {
          const q = queue[qi++];
          if (labels[q] === -2) labels[q] = clusterId; // noise → border
          if (labels[q] !== -1 && labels[q] !== clusterId) continue;
          if (labels[q] === clusterId) continue;
          labels[q] = clusterId;
          const qNeighbours: number[] = [];
          for (let j = 0; j < skinPixels.length; j++) {
            const dx = skinPixels[q].x - skinPixels[j].x;
            const dy = skinPixels[q].y - skinPixels[j].y;
            if (dx * dx + dy * dy <= eps * eps) qNeighbours.push(j);
          }
          if (qNeighbours.length >= minPts) {
            for (const n of qNeighbours) if (labels[n] === -1 || labels[n] === -2) queue.push(n);
          }
        }
        clusterId++;
      }

      // Find largest cluster and compute its centroid
      const clusterSizes = new Map<number, { sumX: number; sumY: number; count: number }>();
      for (let i = 0; i < skinPixels.length; i++) {
        const cid = labels[i];
        if (cid < 0) continue;
        const entry = clusterSizes.get(cid) || { sumX: 0, sumY: 0, count: 0 };
        entry.sumX += skinPixels[i].x;
        entry.sumY += skinPixels[i].y;
        entry.count++;
        clusterSizes.set(cid, entry);
      }
      let bestCluster = { sumX: 0, sumY: 0, count: 0 };
      for (const entry of clusterSizes.values()) {
        if (entry.count > bestCluster.count) bestCluster = entry;
      }
      if (bestCluster.count > 5) {
        personCenterX = bestCluster.sumX / bestCluster.count;
        personCenterY = bestCluster.sumY / bestCluster.count;
      }
    }
    
    // Shift center from face down toward torso for better clothing coverage
    const personRadius = Math.min(width, height) * 0.35;
    personCenterY = Math.min(height * 0.85, personCenterY + personRadius * 0.5);

    // ═══════════════════════════════════════════════════════════════════
    // STAGE 3: Gaussian-weighted CIELab clothing pixel sampling
    // ═══════════════════════════════════════════════════════════════════
    const sigma = personRadius * 0.6;
    const twoSigmaSq = 2 * sigma * sigma;
    
    // Scan region around person
    const bodyStartY = Math.max(0, Math.floor(personCenterY - personRadius * 0.5));
    const bodyEndY   = Math.min(height, Math.ceil(personCenterY + personRadius * 1.8));
    const bodyStartX = Math.max(0, Math.floor(personCenterX - personRadius * 0.8));
    const bodyEndX   = Math.min(width, Math.ceil(personCenterX + personRadius * 0.8));
    
    // Edge texture map (preserved from original)
    const edgeStrength = new Uint8Array(width * height);
    for (let y = 2; y < height - 2; y += edgeStride) {
      for (let x = 2; x < width - 2; x += edgeStride) {
        const idx = (y * width + x) * 4;
        const gx = Math.abs(data[idx + 4] - data[idx - 4]);
        const gy = Math.abs(data[idx + width * 4] - data[idx - width * 4]);
        edgeStrength[y * width + x] = Math.min(255, gx + gy);
      }
    }
    
    // Collect clothing samples in Lab space with Gaussian weights
    interface LabSample { L: number; a: number; b: number; weight: number; r: number; g: number; bVal: number }
    const clothingSamples: LabSample[] = [];
    const MAX_SAMPLES = 2000; // Cap for K-Means performance
    
    // Compute average skin Lab for later skin-cluster rejection
    let skinLabL = 60, skinLabA = 15, skinLabB = 20; // defaults
    if (skinPixels.length > 30) {
      const avgR = skinPixels.reduce((s, p) => s + p.r, 0) / skinPixels.length;
      const avgG = skinPixels.reduce((s, p) => s + p.g, 0) / skinPixels.length;
      const avgB = skinPixels.reduce((s, p) => s + p.b, 0) / skinPixels.length;
      try {
        const skinLab = chroma(avgR, avgG, avgB).lab();
        skinLabL = skinLab[0]; skinLabA = skinLab[1]; skinLabB = skinLab[2];
      } catch { /* use defaults */ }
    }
    
    for (let y = bodyStartY; y < bodyEndY; y += clothingSampleRate) {
      for (let x = bodyStartX; x < bodyEndX; x += clothingSampleRate) {
        if (clothingSamples.length >= MAX_SAMPLES) break;
        const idx = (y * width + x) * 4;
        const r = data[idx], g = data[idx + 1], b = data[idx + 2], a = data[idx + 3];
        
        if (a < 128) continue;
        if (isSkinColor(r, g, b)) continue;
        
        const hsv = rgbToHsv(r, g, b);
        const dx = x - personCenterX;
        const dy = y - personCenterY;
        const distSq = dx * dx + dy * dy;
        const normalizedDist = Math.sqrt(distSq) / personRadius;
        
        // Hard cutoff for far pixels
        if (normalizedDist > 1.2) continue;
        
        // Background rejection (preserved multi-layer filters)
        const isBackground = (
          (hsv.v > 90 && hsv.s < 15) ||
          (hsv.v < 8) ||
          (hsv.s < 8 && normalizedDist > 0.7) ||
          (hsv.h >= 0 && hsv.h <= 35 && hsv.s > 55 && hsv.v > 50 && normalizedDist > 0.9) ||
          (hsv.h >= 35 && hsv.h <= 65 && hsv.s > 40 && hsv.v > 65 && normalizedDist > 0.9) ||
          (hsv.h >= 200 && hsv.h <= 230 && hsv.s > 30 && hsv.s < 60 && hsv.v > 65) ||
          (hsv.h >= 100 && hsv.h <= 140 && hsv.s > 35 && hsv.s < 70 && hsv.v > 50 && normalizedDist > 0.9)
        );
        if (isBackground) continue;
        
        const isClothing = (
          (hsv.s >= 5 && hsv.s <= 95 && hsv.v >= 12 && hsv.v <= 88) ||
          (hsv.s >= 1 && hsv.s <= 15 && hsv.v >= 15 && hsv.v <= 75 && normalizedDist < 0.8)
        );
        if (!isClothing) continue;
        
        // Texture check
        const edgeValue = edgeStrength[y * width + x] || 0;
        const hasTexture = edgeValue > 30;
        if (!hasTexture && normalizedDist > 1.0) continue;
        
        // Gaussian weight: higher near person center, falls off radially
        const gaussianWeight = Math.exp(-distSq / twoSigmaSq);
        const textureBonus = hasTexture ? 1.5 : 1.0;
        const weight = gaussianWeight * textureBonus;
        
        // Convert to CIELab via chroma.js
        try {
          const lab = chroma(r, g, b).lab();
          clothingSamples.push({ L: lab[0], a: lab[1], b: lab[2], weight, r, g, bVal: b });
        } catch {
          // Skip invalid pixels
        }
      }
      if (clothingSamples.length >= MAX_SAMPLES) break;
    }
    
    // ═══════════════════════════════════════════════════════════════════
    // STAGE 4: Determine skin tone (preserved)
    // ═══════════════════════════════════════════════════════════════════
    let skinTone = "medium";
    if (skinPixels.length > 30) {
      const avgR = skinPixels.reduce((sum, p) => sum + p.r, 0) / skinPixels.length;
      const avgG = skinPixels.reduce((sum, p) => sum + p.g, 0) / skinPixels.length;
      const avgB = skinPixels.reduce((sum, p) => sum + p.b, 0) / skinPixels.length;
      const luminance = 0.299 * avgR + 0.587 * avgG + 0.114 * avgB;
      
      if (luminance > 200) skinTone = "very fair";
      else if (luminance > 170) skinTone = "fair";
      else if (luminance > 140) skinTone = "light";
      else if (luminance > 110) skinTone = "tan";
      else if (luminance > 80) skinTone = "brown";
      else skinTone = "dark";
    }
    
    // ═══════════════════════════════════════════════════════════════════
    // STAGE 5: K-Means clustering in CIELab space
    // Replaces histogram-sort with perceptual clustering for more
    // accurate dominant clothing color extraction.
    // ═══════════════════════════════════════════════════════════════════
    const K = Math.min(5, Math.max(2, Math.ceil(clothingSamples.length / 100)));
    
    if (clothingSamples.length < 10) {
      console.timeEnd('colorExtraction');
      return { skinTone, dressColors: 'neutral tones', colorPalette: [] };
    }
    
    // Initialize centroids via K-Means++ for better convergence
    const centroids: { L: number; a: number; b: number }[] = [];
    // Pick first centroid randomly (highest-weight sample for stability)
    const sorted = [...clothingSamples].sort((a, b) => b.weight - a.weight);
    centroids.push({ L: sorted[0].L, a: sorted[0].a, b: sorted[0].b });
    
    for (let c = 1; c < K; c++) {
      // Compute distance of each sample to nearest existing centroid
      let totalDistSq = 0;
      const dists = clothingSamples.map(s => {
        let minD = Infinity;
        for (const cent of centroids) {
          const dL = s.L - cent.L, da = s.a - cent.a, db = s.b - cent.b;
          minD = Math.min(minD, dL * dL + da * da + db * db);
        }
        totalDistSq += minD;
        return minD;
      });
      // Weighted random selection proportional to distance²
      let threshold = Math.random() * totalDistSq;
      for (let i = 0; i < dists.length; i++) {
        threshold -= dists[i];
        if (threshold <= 0) {
          centroids.push({ L: clothingSamples[i].L, a: clothingSamples[i].a, b: clothingSamples[i].b });
          break;
        }
      }
      // Safety: if loop exhausts, pick last
      if (centroids.length <= c) {
        const last = clothingSamples[clothingSamples.length - 1];
        centroids.push({ L: last.L, a: last.a, b: last.b });
      }
    }
    
    // Run K-Means (max 15 iterations — converges fast on small sample)
    const assignments = new Uint8Array(clothingSamples.length);
    for (let iter = 0; iter < 15; iter++) {
      let changed = false;
      
      // Assign each sample to nearest centroid
      for (let i = 0; i < clothingSamples.length; i++) {
        const s = clothingSamples[i];
        let bestD = Infinity, bestC = 0;
        for (let c = 0; c < centroids.length; c++) {
          const dL = s.L - centroids[c].L;
          const da = s.a - centroids[c].a;
          const db = s.b - centroids[c].b;
          const d = dL * dL + da * da + db * db;
          if (d < bestD) { bestD = d; bestC = c; }
        }
        if (assignments[i] !== bestC) { assignments[i] = bestC; changed = true; }
      }
      
      if (!changed) break;
      
      // Recompute centroids (weighted by Gaussian weight)
      for (let c = 0; c < centroids.length; c++) {
        let sumL = 0, sumA = 0, sumB = 0, sumW = 0;
        for (let i = 0; i < clothingSamples.length; i++) {
          if (assignments[i] !== c) continue;
          const w = clothingSamples[i].weight;
          sumL += clothingSamples[i].L * w;
          sumA += clothingSamples[i].a * w;
          sumB += clothingSamples[i].b * w;
          sumW += w;
        }
        if (sumW > 0) {
          centroids[c].L = sumL / sumW;
          centroids[c].a = sumA / sumW;
          centroids[c].b = sumB / sumW;
        }
      }
    }
    
    // Compute cluster populations (weighted)
    const clusterPops = centroids.map(() => 0);
    for (let i = 0; i < clothingSamples.length; i++) {
      clusterPops[assignments[i]] += clothingSamples[i].weight;
    }
    
    // Sort clusters by population (largest first)
    const clusterOrder = centroids.map((c, i) => ({ ...c, pop: clusterPops[i], idx: i }))
      .sort((a, b) => b.pop - a.pop);
    
    // ═══════════════════════════════════════════════════════════════════
    // STAGE 6: Filter clusters and build palette
    // Remove skin-tone clusters, then apply deltaE diversity.
    // ═══════════════════════════════════════════════════════════════════
    const MIN_SKIN_DELTA_E = 18;
    const candidateColors: { hex: string; r: number; g: number; b: number; count: number }[] = [];
    
    for (const cluster of clusterOrder) {
      // Reject clusters too close to detected skin tone
      const dL = cluster.L - skinLabL;
      const da = cluster.a - skinLabA;
      const db = cluster.b - skinLabB;
      const skinDistLab = Math.sqrt(dL * dL + da * da + db * db);
      if (skinDistLab < MIN_SKIN_DELTA_E) continue;
      
      try {
        const rgb = chroma.lab(cluster.L, cluster.a, cluster.b).rgb();
        const hex = chroma.lab(cluster.L, cluster.a, cluster.b).hex();
        candidateColors.push({ hex, r: rgb[0], g: rgb[1], b: rgb[2], count: cluster.pop });
      } catch { /* skip invalid Lab coords */ }
    }
    
    // DeltaE diversity filtering (preserved)
    const diverseColors: typeof candidateColors = [];
    const MIN_DELTA_E = 15;
    
    for (const candidate of candidateColors) {
      if (diverseColors.length === 0) {
        diverseColors.push(candidate);
        continue;
      }
      const isDifferent = diverseColors.every(existing => {
        try {
          return chroma.deltaE(chroma(candidate.hex), chroma(existing.hex)) >= MIN_DELTA_E;
        } catch { return true; }
      });
      if (isDifferent) {
        diverseColors.push(candidate);
        if (diverseColors.length >= 10) break;
      }
    }
    
    // Relax threshold if we have too few colors
    if (diverseColors.length < 5 && candidateColors.length >= 5) {
      for (const candidate of candidateColors) {
        if (diverseColors.some(c => c.hex === candidate.hex)) continue;
        const isDifferent = diverseColors.every(existing => {
          try { return chroma.deltaE(chroma(candidate.hex), chroma(existing.hex)) >= 10; }
          catch { return true; }
        });
        if (isDifferent) {
          diverseColors.push(candidate);
          if (diverseColors.length >= 8) break;
        }
      }
    }
    
    // Color names for backward compatibility
    const dominantColorNames = diverseColors.map(c => getColorName(c.r, c.g, c.b));
    const extractedPalette = diverseColors.map(c => c.hex);
    const uniqueColors = Array.from(new Set(dominantColorNames))
      .filter(color => color !== 'neutral')
      .slice(0, 10);
    
    const dressColorsStr = uniqueColors.join(', ');
    
    console.timeEnd('colorExtraction');

    return { 
      skinTone, 
      dressColors: dressColorsStr || 'neutral tones',
      colorPalette: extractedPalette
    };
  };

  const performAnalysis = async (request: AnalyzeImageAndProvideRecommendationsInput) => {
    const requestId = ++activeRequestIdRef.current;
    const isStale = () => !isMountedRef.current || requestId !== activeRequestIdRef.current;

    analysisAbortRef.current?.abort();
    const controller = new AbortController();
    analysisAbortRef.current = controller;
    const timeoutId = window.setTimeout(() => controller.abort(), 70000);

    const requestWithRetry = async (
      url: string,
      init: RequestInit,
      options: { maxRetries?: number; retryOn429?: boolean } = {}
    ) => {
      const maxRetries = options.maxRetries ?? 2;
      const retryOn429 = options.retryOn429 ?? true;
      let lastError: Error | null = null;

      const parseRetryAfterMs = (retryAfter: string | null): number => {
        if (!retryAfter) return 0;
        const numeric = Number(retryAfter);
        if (!Number.isNaN(numeric) && Number.isFinite(numeric)) {
          return Math.max(0, Math.round(numeric * 1000));
        }

        const parsedDate = Date.parse(retryAfter);
        if (!Number.isNaN(parsedDate)) {
          return Math.max(0, parsedDate - Date.now());
        }

        return 0;
      };

      for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
        const attemptController = new AbortController();
        const onAbort = () => attemptController.abort();
        controller.signal.addEventListener('abort', onAbort, { once: true });
        const attemptTimeout = window.setTimeout(() => attemptController.abort(), 15000);

        try {
          const response = await fetch(url, {
            ...init,
            signal: attemptController.signal,
          });

          const shouldRetry = response.status >= 500 || (retryOn429 && response.status === 429);
          if (shouldRetry && attempt < maxRetries) {
            const retryAfterMs = parseRetryAfterMs(response.headers.get('retry-after'));
            const baseBackoff = response.status === 429 ? 1000 * 2 ** attempt : 500 * 2 ** attempt;
            const waitMs = Math.max(baseBackoff, retryAfterMs);
            await new Promise((resolve) => setTimeout(resolve, waitMs));
            continue;
          }

          return response;
        } catch (error) {
          const err = error instanceof Error ? error : new Error('Network request failed');
          lastError = err;

          if (controller.signal.aborted || attempt >= maxRetries) {
            throw err;
          }

          await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
        } finally {
          window.clearTimeout(attemptTimeout);
          controller.signal.removeEventListener('abort', onAbort);
        }
      }

      throw lastError || new Error('Request failed after retries');
    };

    const toStagedPreview = (statusData: any): StagedPreview | null => {
      const partialAnalysis = statusData?.partialPayload?.analysis;
      if (!partialAnalysis) return null;

      const stageRaw = String(statusData?.progress?.stage || 'queued').toLowerCase();
      const mappedStage: PreviewStage = stageRaw === 'palette'
        ? 'palette'
        : stageRaw === 'outfit_text'
          ? 'outfit_text'
          : stageRaw === 'images'
            ? 'images'
            : stageRaw === 'finalizing'
              ? 'finalizing'
              : 'queued';

      const outfits: StagedPreviewOutfit[] = Array.isArray(partialAnalysis.outfitRecommendations)
        ? partialAnalysis.outfitRecommendations.map((outfit: any) => ({
          title: outfit?.title || 'Outfit recommendation',
          description: outfit?.description || '',
          colorPalette: Array.isArray(outfit?.colorPalette)
            ? outfit.colorPalette.map((color: any) => {
              if (typeof color === 'string') return color;
              return color?.hex || '#000000';
            })
            : [],
          imageUrl: typeof outfit?.imageUrl === 'string' ? outfit.imageUrl : null,
        }))
        : [];

      return {
        stage: mappedStage,
        queueWaitMs: typeof statusData?.progress?.queueWaitMs === 'number' ? statusData.progress.queueWaitMs : undefined,
        imagesReady: typeof statusData?.progress?.imagesReady === 'number' ? statusData.progress.imagesReady : 0,
        totalImages: typeof statusData?.progress?.totalImages === 'number' ? statusData.progress.totalImages : Math.max(outfits.length, 3),
        analysis: {
          feedback: partialAnalysis.feedback || '',
          highlights: Array.isArray(partialAnalysis.highlights) ? partialAnalysis.highlights : [],
          colorSuggestions: Array.isArray(partialAnalysis.colorSuggestions) ? partialAnalysis.colorSuggestions : [],
          outfitRecommendations: outfits,
          notes: partialAnalysis.notes || '',
          imagePrompt: partialAnalysis.imagePrompt || '',
          provider: partialAnalysis.provider,
        },
      };
    };

    setIsLoading(true);
    setAllContentReady(false);
    setShowResults(false); // Hide previous results immediately
    setAnalysisResult(null);
    setGeneratedImageUrls([]);
    setImageSources([]);
    setFallbackMessage(null);
    setCompletionGlow(false);
    setStagedPreview({
      stage: 'queued',
      queueWaitMs: 0,
      imagesReady: 0,
      totalImages: 3,
      analysis: {
        feedback: '',
        highlights: [],
        colorSuggestions: (extractedData?.colorPalette || []).slice(0, 6).map((hex) => ({
          name: hex,
          hex,
          reason: 'Detected from your uploaded image.',
        })),
        outfitRecommendations: [],
        notes: '',
        imagePrompt: '',
        provider: 'gemini',
      },
    });
    setResultMeta(null);
    
    // Initialize processing steps
    initializeProcessingSteps();

    try {
      if (!request.previousRecommendation) {
        updateStep('extract', 'processing');
        setLoadingMessage("Extracting colors from your image...");
      setProgressStage(0);

        // Use the skinTone and dressColors from the request or extractedData
        const skinToneValue = request.skinTone || extractedData?.skinTone || '';
        const dressColorsValue = request.dressColors || extractedData?.dressColors || '';
        
        request.skinTone = skinToneValue;
        request.dressColors = dressColorsValue;

        setLastAnalysisRequest({
          photoDataUri: request.photoDataUri,
          occasion: request.occasion,
          genre: request.genre,
          gender: request.gender,
          weather: request.weather,
          skinTone: skinToneValue,
          dressColors: dressColorsValue,
          userId: request.userId,
        });
        
        updateStep('extract', 'complete');
      }

      updateStep('analyze', 'processing');
      updateStep('generate', 'processing');
      updateStep('enhance', 'processing');
      updateStep('search', 'processing');
      setLoadingMessage("Analyzing your style with AI...");
      setProgressStage(1);

      // Call the /api/recommend route which handles everything:
      // 1. Gemini style analysis
      // 2. Image generation with Pollinations (sequential with delays)
      // 3. Gemini image analysis for accurate colors
      // 4. Optimized Tavily search with proper queries
      
      // Build auth headers if user is authenticated
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (!auth.currentUser) {
        toast({
          variant: 'destructive',
          title: 'Sign in required',
          description: 'Please sign in again to continue with style analysis.',
        });
        return;
      }

      let idToken: string;
      try {
        idToken = await auth.currentUser.getIdToken();
      } catch {
        toast({
          variant: 'destructive',
          title: 'Authentication required',
          description: 'Your session expired. Please sign in again to continue.',
        });
        return;
      }
      headers['Authorization'] = `Bearer ${idToken}`;

      const apiRequest = {
        ...request,
        userId: auth.currentUser.uid,
        uxVariant,
      };

      const response = await requestWithRetry('/api/recommend', {
        method: 'POST',
        headers,
        body: JSON.stringify(apiRequest),
      }, {
        maxRetries: 1,
        retryOn429: false,
      });

      if (isStale()) return;

      if (!response.ok) {
        if (response.status === 429) {
          const retryAfterHeader = response.headers.get('retry-after');
          const retryAfterSeconds = Number(retryAfterHeader);
          if (!Number.isNaN(retryAfterSeconds) && retryAfterSeconds > 0) {
            setRecommendCooldownUntil(Date.now() + retryAfterSeconds * 1000);
          }
        }

        let errorData: { error?: string; message?: string; code?: string } = { error: 'Unknown error' };
        try {
          errorData = await response.json();
        } catch {
          // Use status text as fallback
          errorData = { error: response.statusText || 'API request failed', code: 'HTTP_ERROR' };
        }
        throw new Error(errorData.error || errorData.message || `API request failed with status ${response.status}`);
      }

      let data: any;
      try {
        data = await response.json();
      } catch {
        throw new Error('Received an invalid server response. Please try again.');
      }

      setRecommendCooldownUntil(null);

      if (isStale()) return;

      if (data?.status === 'queued') {
        const jobId = data?.jobId;
        if (!jobId || typeof jobId !== 'string') {
          throw new Error('Queued response is missing a valid job id.');
        }

        setLoadingMessage('Preparing your personalized recommendations...');

        const pollTimeoutMs = 65_000;
        const pollIntervalMs = 1_500;
        const pollStart = Date.now();
        let finalStatusData: any = null;

        while (Date.now() - pollStart < pollTimeoutMs) {
          if (controller.signal.aborted) {
            throw new Error('Request cancelled');
          }

          await new Promise((resolve) => window.setTimeout(resolve, pollIntervalMs));
          if (isStale()) return;

          const statusResponse = await requestWithRetry(
            `/api/recommend/status?jobId=${encodeURIComponent(jobId)}&userId=${encodeURIComponent(auth.currentUser.uid)}`,
            {
              method: 'GET',
              headers,
            },
            { maxRetries: 1 }
          );

          if (!statusResponse.ok) {
            let statusError: { error?: string; message?: string } = { error: 'Unable to check recommendation status' };
            try {
              statusError = await statusResponse.json();
            } catch {
              statusError = { error: statusResponse.statusText || 'Status check failed' };
            }
            throw new Error(statusError.error || statusError.message || 'Status check failed');
          }

          let statusData: any;
          try {
            statusData = await statusResponse.json();
          } catch {
            throw new Error('Received an invalid status response. Please try again.');
          }

          const previewFromStatus = toStagedPreview(statusData);
          if (previewFromStatus && !isStale()) {
            setStagedPreview(previewFromStatus);
          }

          if (statusData?.status === 'queued' || statusData?.status === 'processing') {
            const stage = String(statusData?.progress?.stage || '').toLowerCase();
            const ready = Number(statusData?.progress?.imagesReady || 0);
            const total = Number(statusData?.progress?.totalImages || 3);
            setLoadingMessage(getFriendlyStageMessage(stage, ready, total, uxVariant));

            if (stage === 'outfit_text' || stage === 'images' || stage === 'finalizing') {
              setProgressStage(2);
            } else {
              setProgressStage(1);
            }
            continue;
          }

          if (statusData?.status === 'completed' || statusData?.status === 'failed') {
            finalStatusData = statusData;
            break;
          }
        }

        if (!finalStatusData) {
          throw new Error('Analysis timed out. Please try again.');
        }

        data = finalStatusData;
      }

      
  setLoadingMessage('Finalizing your recommendations...');
      setStagedPreview(null);

      const userFacingFallbackMessage = getFallbackFriendlyMessage(data?.fallbackSource, data?.cacheSource, uxVariant);
  setFallbackMessage(userFacingFallbackMessage);

      const completedAt = typeof data?.completedAt === 'number' ? data.completedAt : Date.now();
      const isFresh = Date.now() - completedAt <= 2 * 60 * 1000;
      const usedFallback = Boolean(data?.fallbackSource) || ['fallback', 'timeout-fallback', 'exact-cache-recovery', 'similar-recovery'].includes(String(data?.cacheSource || ''));
      setResultMeta({ isFresh, usedFallback });

      if (!data.success || !data.payload) {
        throw new Error('Invalid API response structure');
      }

      const result = data.payload.analysis;
      if (!result || !Array.isArray(result.outfitRecommendations)) {
        throw new Error('Server response was incomplete. Please try again.');
      }

      const enrichedOutfits = result.outfitRecommendations;
      
      // ✅ VALIDATION: Ensure all outfits have complete data
      const hasCompleteData = enrichedOutfits.every((outfit: any) => {
        const hasImage = !!outfit.imageUrl;
        const hasColors = outfit.colorPalette && outfit.colorPalette.length > 0;
        const hasLinks = outfit.shoppingLinks && (
          outfit.shoppingLinks.amazon || 
          outfit.shoppingLinks.myntra || 
          outfit.shoppingLinks.tatacliq
        );
        
        
        return hasImage && hasColors && hasLinks;
      });

      if (!hasCompleteData) {
      } else {
      }
      
      updateStep('analyze', 'complete');
      updateStep('generate', 'complete');
      updateStep('enhance', 'complete');
      updateStep('search', 'complete');
      
      setProgressStage(2);
      setLoadingMessage("Preparing images for display...");
      
      // Use the recommendation ID from the API if available
      const recId = data.recommendationId || `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setRecommendationId(recId);

      // Extract image URLs from the enriched outfits
      const imageUrls = enrichedOutfits.map((outfit: any) => outfit.imageUrl || '');
      const sources = enrichedOutfits.map((outfit: any) => {
        const url: string = outfit.imageUrl || '';
        if (!url || url.includes('via.placeholder.com')) return 'placeholder' as const;
        if (url.includes('together.xyz') || url.includes('together.ai')) return 'gemini' as const;
        if (url.includes('firebasestorage.googleapis.com')) return 'gemini' as const;
        if (url.includes('replicate.delivery')) return 'gemini' as const;
        if (url.startsWith('data:image/svg')) return 'placeholder' as const;
        if (url.startsWith('data:image/png')) return 'gemini' as const;
        if (url.includes('pollinations')) return 'pollinations' as const;
        return 'gemini' as const;
      });

      setGeneratedImageUrls(imageUrls);
      setImageSources(sources);

      // Show results immediately — image loading is handled per-card in the results component
      updateStep('finalize', 'processing');
      if (isStale()) return;

      setAnalysisResult(result);
      setAllContentReady(true);
      setShowResults(true);
      setCompletionGlow(true);
      window.setTimeout(() => {
        if (isMountedRef.current && requestId === activeRequestIdRef.current) {
          setCompletionGlow(false);
        }
      }, 1600);
      updateStep('finalize', 'complete');
      setLoadingMessage('');

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('usage:consumed', { detail: { scope: 'recommend' } }));
      }

      
      // Show success toast
      toast({
        title: "✨ Success!",
        description: `Your personalized recommendations are ready!`,
        duration: 3000,
      });

    } catch (e) {
      if (!isMountedRef.current) return;
      if (controller.signal.aborted) {
        toast({
          title: "Request cancelled",
          description: "The analysis was stopped. You can try again anytime.",
          duration: 3000,
        });
        return;
      }

      const errorMessage = e instanceof Error ? e.message : 'An unexpected error occurred';
      
      // Mark current step as error
      const currentStep = processingSteps.find(s => s.status === 'processing');
      if (currentStep) {
        updateStep(currentStep.id, 'error', errorMessage);
      }
      
      // Determine error type and show appropriate message
      let title = "Analysis Failed";
      let description = "An unexpected error occurred. Please try again.";
      
      const normalizedError = errorMessage.toLowerCase();

      if (normalizedError.includes('high demand') || normalizedError.includes('overloaded') || normalizedError.includes('temporarily unavailable')) {
        title = "Service Busy";
        description = "⏳ Our AI service is experiencing high demand. Please wait 30-60 seconds and try again. We apologize for the inconvenience!";
      } else if (normalizedError.includes('rate limit') || normalizedError.includes('quota')) {
        title = "Rate Limit Reached";
        description = "⏱️ Too many requests. Please wait a minute and try again.";
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('usage:consumed', { detail: { scope: 'recommend' } }));
        }
      } else if (errorMessage.includes('schema validation')) {
        title = "AI Response Error";
        description = "The AI response was incomplete. Please try again.";
      } else if (errorMessage.includes('network') || errorMessage.includes('fetch') || errorMessage.includes('Failed to fetch')) {
        title = "Connection Error";
        description = "🌐 Network connection issue. Please check your internet and try again.";
      } else if (errorMessage.includes('invalid server response')) {
        title = "Server Response Error";
        description = "The server returned an invalid response. Please retry.";
      } else {
        description = errorMessage.length > 100 
          ? "An error occurred. Please try again or contact support if it persists."
          : errorMessage;
      }
      
      const fallbackAnalysis = buildDemoFallbackAnalysis();
      const fallbackImages = [
        'https://via.placeholder.com/1024x1365/1e3a8a/f8f5f0?text=Demo+Look+1',
        'https://via.placeholder.com/1024x1365/1f2937/d6c7b0?text=Demo+Look+2',
        'https://via.placeholder.com/1024x1365/64748b/f8f5f0?text=Demo+Look+3',
      ];

      setAnalysisResult(fallbackAnalysis);
      setGeneratedImageUrls(fallbackImages);
      setImageSources(['placeholder', 'placeholder', 'placeholder']);
      setRecommendationId(`demo_fallback_${Date.now()}`);
      setFallbackMessage('Live demo fallback enabled: showing a stable sample result.');
      setResultMeta({ isFresh: true, usedFallback: true });
      setStagedPreview(null);
      setLoadingMessage('');
      setAllContentReady(true);
      setShowResults(true);

      updateStep('analyze', 'complete');
      updateStep('generate', 'complete');
      updateStep('enhance', 'complete');
      updateStep('search', 'complete');
      updateStep('finalize', 'complete');

      toast({
        title,
        description: `${description} Showing demo-safe recommendations now.`,
        duration: 4500,
      });
    } finally {
      window.clearTimeout(timeoutId);
      submitInFlightRef.current = false;
      if (isMountedRef.current && requestId === activeRequestIdRef.current) {
        setIsLoading(false);
      }
      // Don't set allContentReady on error - it should only be true when everything is ready
    }
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (recommendCooldownUntil && Date.now() < recommendCooldownUntil) {
      const secondsRemaining = Math.max(1, Math.ceil((recommendCooldownUntil - Date.now()) / 1000));
      toast({
        variant: 'destructive',
        title: 'Please wait before retrying',
        description: `Recommendation service is cooling down. Try again in ${secondsRemaining}s.`,
      });
      return;
    }

    if (isLimitReached) {
      toast({
        variant: "destructive",
        title: "Daily limit reached",
        description: "You have used all style analyses for today. Try again after reset.",
      });
      return;
    }

    if (isLoading) {
      toast({
        title: "Analysis in progress",
        description: "Please wait for the current analysis to finish.",
      });
      return;
    }

    if (submitInFlightRef.current) {
      toast({
        title: "Request already in progress",
        description: "Please wait while we process your current recommendation.",
      });
      return;
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      toast({
        variant: "destructive",
        title: "You're offline",
        description: "Reconnect to the internet to analyze your outfit.",
      });
      return;
    }

    if (!weather) {
      toast({
        variant: "destructive",
        title: "Weather information not available",
        description: "Please wait a moment and try again.",
      });
      return;
    }

    if (!previewImage) {
      toast({ variant: 'destructive', title: 'Image not selected', description: 'Please select an image to analyze.' });
      return;
    }

    // Final validation check before analysis
    if (imageValidationError) {
      toast({
        variant: "destructive",
        title: "Cannot proceed",
        description: imageValidationError,
      });
      return;
    }

    submitInFlightRef.current = true;

    const imageElement = document.createElement('img');
    const PRELOAD_TIMEOUT_MS = 12_000;
    let resolved = false;
    const cleanupPreload = () => {
      imageElement.onload = null;
      imageElement.onerror = null;
    };

    const preloadTimeoutId = window.setTimeout(() => {
      if (resolved) return;
      resolved = true;
      cleanupPreload();
      submitInFlightRef.current = false;
      toast({
        variant: 'destructive',
        title: 'Image validation timed out',
        description: 'Please reselect your image and try again.',
      });
    }, PRELOAD_TIMEOUT_MS);

    imageElement.src = previewImage;
    imageElement.onload = async () => {
        if (resolved) return;
        resolved = true;
        window.clearTimeout(preloadTimeoutId);
        cleanupPreload();

        const canvas = canvasRef.current;
        if (!canvas) {
          submitInFlightRef.current = false;
          toast({
            variant: 'destructive',
            title: 'Unable to start analysis',
            description: 'Please try again in a moment.',
          });
          return;
        }

        canvas.width = imageElement.width;
        canvas.height = imageElement.height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(imageElement, 0, 0);

        // Get user ID for personalization
        const userId = auth.currentUser?.uid;

        await performAnalysis({
          photoDataUri: previewImage,
          occasion: values.occasion,
          genre: values.genre,
          gender: values.gender,
          weather: weather,
          skinTone: '',
          dressColors: '',
          userId,
        });
    };
    imageElement.onerror = () => {
      if (resolved) return;
      resolved = true;
      window.clearTimeout(preloadTimeoutId);
      cleanupPreload();
      submitInFlightRef.current = false;
      toast({ variant: 'destructive', title: 'Image Load Error', description: 'Could not load the selected image for analysis.' });
    };
  };

  const handleGetAnotherRecommendation = async () => {
    if (isLimitReached) {
      toast({
        variant: "destructive",
        title: "Daily limit reached",
        description: "You have used all style analyses for today. Try again after reset.",
      });
      return;
    }

    if (!lastAnalysisRequest || !analysisResult) return;

    if (submitInFlightRef.current || isLoading) {
      toast({
        title: 'Analysis in progress',
        description: 'Please wait for the current analysis to finish.',
      });
      return;
    }

    void fetch('/api/recommend/interaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ variant: uxVariant, event: 'another_recommendation' }),
    }).catch(() => {
      // Interaction telemetry is best effort.
    });

    await performAnalysis({
      ...lastAnalysisRequest,
      previousRecommendation: JSON.stringify(analysisResult),
    });
  };

  return (
    <div className="space-y-12">
      <canvas ref={canvasRef} className="hidden"></canvas>
      {showCamera && (
        <video ref={videoRef} autoPlay playsInline className="hidden" />
      )}

      {!analysisResult && !isLoading && (
        <Card className="w-full shadow-2xl shadow-accent/20 border-border/20 animate-slide-up-fade bg-card/60 dark:bg-card/40 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-xl sm:text-2xl md:text-3xl font-headline">Create Your Style Profile</CardTitle>
            <CardDescription>
              Tell us a bit about your look, and our AI will provide personalized feedback.
            </CardDescription>
            {!auth.currentUser && (
              <Alert className="mt-4 border-blue-500/50 bg-blue-500/10">
                <AlertCircle className="h-4 w-4 text-blue-600" />
                <AlertTitle className="text-blue-700 dark:text-blue-400">💡 Get Personalized Recommendations</AlertTitle>
                <AlertDescription className="text-blue-600 dark:text-blue-300">
                  Sign in to save your preferences and get increasingly personalized outfit recommendations based on your style history!
                </AlertDescription>
              </Alert>
            )}
            <Alert className="mt-4 border-green-500/50 bg-green-500/10">
              <AlertCircle className="h-4 w-4 text-green-600" />
              <AlertTitle className="text-green-700 dark:text-green-400">🔒 Privacy-First Design</AlertTitle>
              <AlertDescription className="text-green-600 dark:text-green-300">
                Your photo is never sent to our servers. Color and style analysis happens right in your browser to protect your privacy.
              </AlertDescription>
            </Alert>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <FormField
                  control={form.control}
                  name="image"
                  render={({ field }) => (
                    <FormItem>
                      <span className="text-base font-semibold text-foreground">1. Upload Your Outfit or Take a Photo</span>
                      
                      {/* Validation Error Alert */}
                      {imageValidationError && (
                        <Alert variant="destructive" className="mb-4">
                          <AlertCircle className="h-4 w-4" />
                          <AlertTitle>Invalid Image</AlertTitle>
                          <AlertDescription>{imageValidationError}</AlertDescription>
                        </Alert>
                      )}

                      {/* Validating State */}
                      {isValidatingImage && (
                        <Alert className="mb-4">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <AlertTitle>Validating Image...</AlertTitle>
                          <AlertDescription>Checking if the image contains a person with visible clothing...</AlertDescription>
                        </Alert>
                      )}

                      <FormControl>
                        <div className="space-y-4">
                          {!previewImage && !showCamera && (
                            <div className="flex gap-3">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => fileInputRef.current?.click()}
                                className="flex-1"
                                disabled={isValidatingImage}
                              >
                                <UploadCloud className="mr-2 h-4 w-4" />
                                Upload Photo
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={startCamera}
                                className="flex-1"
                                disabled={isValidatingImage}
                              >
                                <Camera className="mr-2 h-4 w-4" />
                                Take Photo
                              </Button>
                            </div>
                          )}

                          {showCamera && (
                            <div className="relative">
                              <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                className="w-full rounded-lg"
                              />
                              <div className="mt-3 flex gap-3">
                                <Button
                                  type="button"
                                  onClick={capturePhoto}
                                  className="flex-1"
                                  disabled={isValidatingImage}
                                >
                                  <Camera className="mr-2 h-4 w-4" />
                                  Capture Photo
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => {
                                    stopCamera();
                                    setShowCamera(false);
                                  }}
                                  disabled={isValidatingImage}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          )}

                          {!showCamera && (
                            <div className="relative flex justify-center items-center w-full h-52 sm:h-64 md:h-80 rounded-lg p-3 sm:p-4 text-center cursor-pointer bg-primary/20 group animate-fade-in-up transition-all duration-300 ease-in-out transform hover:scale-105 hover:shadow-2xl hover:shadow-accent/20"
                                style={{
                                  border: "2px dashed hsl(var(--border))",
                                  boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05), inset 0 0 10px 5px rgba(255,255,255,0.05)"
                                }}>
                              <Input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                onChange={(e) => {
                                  field.onChange(e.target.files);
                                  handleImageChange(e);
                                }}
                              />
                              {previewImage ? (
                                <>
                                  <Image
                                    src={previewImage}
                                    alt="Outfit preview"
                                    fill
                                    style={{ objectFit: 'contain' }}
                                    className="rounded-md p-2"
                                    data-ai-hint="person outfit"
                                  />
                                  <Button
                                    type="button"
                                    variant="destructive"
                                    size="icon"
                                    className="absolute top-2 right-2 z-10"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      removeImage();
                                    }}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </>
                              ) : (
                                <div className="flex flex-col items-center justify-center space-y-2 text-muted-foreground group-hover:text-accent transition-colors">
                                  <UploadCloud className="w-12 h-12 text-accent/80 group-hover:text-accent transition-colors" />
                                  <p className="font-semibold">Click to upload or drag and drop</p>
                                  <p className="text-xs">PNG, JPG up to 10MB</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-6">
                  <FormField
                    control={form.control}
                    name="occasion"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base font-semibold">2. Describe the Occasion</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="e.g., Casual brunch, formal wedding, birthday party..." 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="genre"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base font-semibold">3. Define the Style Genre</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="e.g., Streetwear, minimalist, formal, vintage..." 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="gender"
                    render={({ field }) => (
                      <FormItem>
                        <span className="text-base font-semibold text-foreground">4. Select Your Gender</span>
                        <div className="flex flex-wrap gap-3 pt-2" role="radiogroup" aria-label="Select your gender">
                          {genders.map((gender) => (
                            <Button
                              key={gender.value}
                              type="button"
                              variant={field.value === gender.value ? "default" : "outline"}
                              className={cn(
                                "rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 transform hover:scale-105",
                                field.value === gender.value
                                  ? "bg-accent text-accent-foreground shadow-lg"
                                  : "bg-primary/50 border-border/50"
                              )}
                              onClick={() => field.onChange(gender.value)}
                            >
                              <User className="w-4 h-4 mr-2" />
                              {gender.label}
                            </Button>
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Button 
                  type="submit" 
                  size="lg" 
                  className="w-full text-lg font-bold bg-gradient-to-r from-accent to-primary text-primary-foreground hover:shadow-lg hover:shadow-accent/30 transition-all duration-300 hover:scale-105" 
                  disabled={isLimitReached || isLoading || isFetchingWeather || isValidatingImage || !!imageValidationError}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      {loadingMessage}
                    </>
                  ) : isValidatingImage ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Validating Image...
                    </>
                  ) : isFetchingWeather ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Fetching Weather...
                    </>
                  ) : isLimitReached ? (
                    "Daily Limit Reached"
                  ) : (
                    "Get Style Advice"
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <div className="space-y-8">
          {/* Enhanced Progress Indicator */}
          <Card className="w-full shadow-lg animate-slide-up-fade bg-card/60 dark:bg-card/40 backdrop-blur-xl">
            <CardContent className="p-4 sm:p-6 md:p-8">
              <RecommendationProgress currentStage={progressStage} />
              <motion.p
                key={loadingMessage}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className="text-sm text-muted-foreground text-center mt-4"
              >
                {loadingMessage}
              </motion.p>
              <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
                {(TRUST_CUES_BY_VARIANT[uxVariant] || TRUST_CUES).map((cue) => (
                  <span
                    key={cue}
                    className="text-[11px] text-muted-foreground px-2.5 py-1 rounded-full border border-border/40 bg-background/50"
                  >
                    {cue}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="w-full shadow-lg bg-card/60 dark:bg-card/40 backdrop-blur-xl">
            <CardContent className="p-4 sm:p-6 space-y-6">
              <AnimatePresence mode="popLayout">
                {stagedPreview?.analysis.colorSuggestions?.length ? (
                  <motion.div
                    key="stage-palette"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-3"
                  >
                    <p className="text-sm font-semibold text-muted-foreground">{getFriendlyStageMessage('palette', stagedPreview?.imagesReady || 0, stagedPreview?.totalImages || 3, uxVariant)}</p>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                      {stagedPreview.analysis.colorSuggestions.slice(0, 6).map((color, idx) => (
                        <div key={`${color.hex}-${idx}`} className="rounded-lg border border-border/30 p-2 bg-background/50">
                          <div
                            className="h-8 rounded-md border border-border/20"
                            style={{ backgroundColor: color.hex || '#808080' }}
                          />
                          <p className="mt-1 text-[11px] text-muted-foreground truncate">{color.name || color.hex}</p>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="stage-palette-skeleton"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-3"
                  >
                    <p className="text-sm font-semibold text-muted-foreground">{getFriendlyStageMessage('palette', stagedPreview?.imagesReady || 0, stagedPreview?.totalImages || 3, uxVariant)}</p>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                      {Array.from({ length: 6 }).map((_, idx) => (
                        <div key={`palette-skeleton-${idx}`} className="h-14 rounded-lg bg-muted animate-pulse" />
                      ))}
                    </div>
                  </motion.div>
                )}

                <motion.div
                  key="stage-text"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35 }}
                  className="space-y-3"
                >
                  <p className="text-sm font-semibold text-muted-foreground">{getFriendlyStageMessage('outfit_text', stagedPreview?.imagesReady || 0, stagedPreview?.totalImages || 3, uxVariant)}</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {(stagedPreview?.analysis.outfitRecommendations?.length
                      ? stagedPreview.analysis.outfitRecommendations.slice(0, 3)
                      : Array.from({ length: 3 }).map((_, idx) => ({
                        title: `Outfit ${idx + 1}`,
                        description: '',
                        colorPalette: [],
                        imageUrl: null,
                      }))
                    ).map((outfit, idx) => (
                      <motion.div
                        key={`outfit-text-${idx}`}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25, delay: idx * 0.06 }}
                        className="rounded-xl border border-border/30 bg-background/40 p-3 min-h-28"
                      >
                        <p className="text-sm font-semibold truncate">{outfit.title}</p>
                        {outfit.description ? (
                          <p className="text-xs text-muted-foreground mt-2 line-clamp-3">{outfit.description}</p>
                        ) : (
                          <div className="space-y-2 mt-2">
                            <div className="h-2 rounded bg-muted animate-pulse" />
                            <div className="h-2 rounded bg-muted animate-pulse w-10/12" />
                            <div className="h-2 rounded bg-muted animate-pulse w-8/12" />
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </motion.div>

                <motion.div
                  key="stage-images"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35 }}
                  className="space-y-3"
                >
                  <p className="text-sm font-semibold text-muted-foreground">
                    {getFriendlyStageMessage('images', stagedPreview?.imagesReady || 0, stagedPreview?.totalImages || 3, uxVariant)}
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {(stagedPreview?.analysis.outfitRecommendations?.length
                      ? stagedPreview.analysis.outfitRecommendations.slice(0, 3)
                      : Array.from({ length: 3 }).map((_, idx) => ({
                        title: `Outfit ${idx + 1}`,
                        description: '',
                        colorPalette: [],
                        imageUrl: null,
                      }))
                    ).map((outfit, idx) => (
                      <div key={`outfit-image-${idx}`} className="rounded-xl overflow-hidden border border-border/30 bg-background/40">
                        {outfit.imageUrl ? (
                          <div className="relative h-44 w-full">
                            <Image
                              src={outfit.imageUrl}
                              alt={outfit.title || `Outfit ${idx + 1}`}
                              fill
                              className="object-cover"
                              sizes="(max-width: 768px) 100vw, 33vw"
                            />
                          </div>
                        ) : (
                          <div className="h-44 bg-muted animate-pulse" />
                        )}
                      </div>
                    ))}
                  </div>
                </motion.div>
              </AnimatePresence>
            </CardContent>
          </Card>

          {!stagedPreview?.analysis.outfitRecommendations?.length && (
            <div className="space-y-4">
              <h3 className="text-2xl font-bold text-center">Preparing your personalized outfits...</h3>
              <OutfitSkeletonGrid />
            </div>
          )}
        </div>
      )}

      <AnimatePresence mode="wait">
        {showResults && analysisResult && allContentReady && !isLoading && (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 20, scale: 0.995 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <Card className={cn(
              "w-full animate-slide-up-fade border-accent/30 bg-card/60 dark:bg-card/40 backdrop-blur-xl transition-all duration-700",
              completionGlow ? "shadow-2xl shadow-emerald-400/35 ring-1 ring-emerald-300/40" : "shadow-xl shadow-accent/20"
            )}>
              <CardContent className="p-6 md:p-8">
                {fallbackMessage && (
                  <motion.p
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="mb-4 text-sm text-muted-foreground"
                  >
                    {fallbackMessage}
                  </motion.p>
                )}
                {(resultMeta?.isFresh || resultMeta?.usedFallback) && (
                  <motion.p
                    initial={{ opacity: 0, y: 2 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                    className="mb-3 text-[11px] text-muted-foreground/90"
                  >
                    Updated just now • Refined for your current input
                  </motion.p>
                )}
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.35, delay: 0.08 }}
                  className="mb-4 text-xs text-muted-foreground"
                >
                  {(TRUST_CUES_BY_VARIANT[uxVariant] || TRUST_CUES).join(' • ')}
                </motion.p>
                <StyleAdvisorResults 
                  analysisResult={analysisResult} 
                  generatedImageUrls={generatedImageUrls}
                  imageSources={imageSources}
                  recommendationId={recommendationId}
                  gender={lastAnalysisRequest?.gender}
                  detectedDressColors={lastAnalysisRequest?.dressColors || extractedData?.dressColors}
                />
              </CardContent>
              <CardFooter className="flex flex-col md:flex-row gap-4 p-6 bg-primary/20">
                <Button onClick={handleGetAnotherRecommendation} variant="outline" className="w-full text-base" disabled={isLimitReached}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Get Another Recommendation
                </Button>
                <Button onClick={resetForm} variant="secondary" className="w-full text-base">
                  <UploadCloud className="mr-2 h-4 w-4" />
                  Analyze Another Outfit
                </Button>
              </CardFooter>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
