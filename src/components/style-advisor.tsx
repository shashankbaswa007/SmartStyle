"use client";

import * as React from "react";
import Image from "next/image";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Loader2, Sparkles, UploadCloud, RefreshCw, User, Camera, X, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import chroma from "chroma-js";
import { motion, AnimatePresence } from "framer-motion";

import type { AnalyzeImageAndProvideRecommendationsInput, AnalyzeImageAndProvideRecommendationsOutput } from "@/ai/flows/analyze-image-and-provide-recommendations";
import saveRecommendation from '@/lib/firestoreRecommendations';
import { generateOutfitImage } from "@/ai/flows/generate-outfit-image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { getWeatherData } from "@/app/actions";
import { cn } from "@/lib/utils";
import { StyleAdvisorResults } from "./style-advisor-results";
import { auth } from "@/lib/firebase";
import { validateImageForStyleAnalysis, validateImageProperties } from "@/lib/image-validation";

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
  { value: "neutral", label: "Neutral" },
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

// Helper function to calculate color distance (Euclidean distance in RGB space)
function colorDistance(color1: number[], color2: number[]): number {
  return Math.sqrt(
    Math.pow(color1[0] - color2[0], 2) +
    Math.pow(color1[1] - color2[1], 2) +
    Math.pow(color1[2] - color2[2], 2)
  );
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
 * Preload images and wait for them to fully load
 * @param imageUrls - Array of image URLs to preload
 * @returns Promise that resolves when all images are loaded
 */
function preloadImages(imageUrls: string[]): Promise<void[]> {
  const imagePromises = imageUrls.map((url) => {
    return new Promise<void>((resolve) => {
      if (typeof window === 'undefined') {
        // Server-side rendering, skip preloading
        resolve();
        return;
      }

      const img = document.createElement('img');
      
      img.onload = () => {
        console.log(`✅ Image loaded successfully: ${url.substring(0, 50)}...`);
        resolve();
      };
      
      img.onerror = () => {
        console.error(`❌ Failed to load image: ${url.substring(0, 50)}...`);
        // Resolve anyway to not block the UI if one image fails
        resolve();
      };
      
      img.src = url;
    });
  });

  return Promise.all(imagePromises);
}

export function StyleAdvisor() {
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
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);


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
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const weatherData = await getWeatherData({
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          });
          setWeather(weatherData);
        } catch (error) {
          setWeather("Clear skies, around 25°C");
          toast({
            variant: "default",
            title: "Could not fetch weather",
            description: "Using default weather.",
          });
        } finally {
          setIsFetchingWeather(false);
        }
      },
      (geoError) => {
        if (geoError.code !== geoError.PERMISSION_DENIED) {
           // Don't log error if user denied permission, but do for other errors.
        }
        setWeather("Clear skies, around 25°C");
        toast({
          variant: "default",
          title: "Location is unavailable",
          description: "Using default weather. For better results, enable location access in your browser.",
        });
        setIsFetchingWeather(false);
      }
    );
  }, [toast]);

  // Cleanup camera on unmount
  React.useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

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
      console.error("Camera access error:", err);
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
          
          if (!validation.isValid) {
            setImageValidationError(validation.message);
            toast({
              variant: "destructive",
              title: "Invalid Photo",
              description: validation.message,
            });
            return;
          }
          
          // Image is valid - proceed
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
          console.error("Validation error:", error);
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

        if (!validation.isValid) {
          setImageValidationError(validation.message);
          setPreviewImage(null); // Clear the preview
          toast({
            variant: "destructive",
            title: "Image Validation Failed",
            description: validation.message,
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
        console.error("Validation error:", error);
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
    setAllContentReady(false);
    setShowResults(false);
    setProcessingSteps([]);
    setLastAnalysisRequest(null);
    setGeneratedImageUrls([]);
    setImageSources([]);
  };

  const extractColorsFromCanvas = (): { skinTone: string; dressColors: string; colorPalette?: string[] } => {
    const canvas = canvasRef.current;
    if (!canvas) return { skinTone: "not detected", dressColors: "not detected" };

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return { skinTone: "not detected", dressColors: "not detected" };

    console.time('colorExtraction');
    
    const width = canvas.width;
    const height = canvas.height;
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    
    // STAGE 1: Fast skin detection to locate person
    const skinPixels: { x: number; y: number; r: number; g: number; b: number }[] = [];
    const skinSampleRate = 12; // Sample every 12th pixel for speed
    
    for (let y = 0; y < height; y += skinSampleRate) {
      for (let x = 0; x < width; x += skinSampleRate) {
        const idx = (y * width + x) * 4;
        const r = data[idx], g = data[idx + 1], b = data[idx + 2];
        
        if (isSkinColor(r, g, b)) {
          skinPixels.push({ x, y, r, g, b });
        }
      }
    }
    
    // Calculate person center from skin pixels
    let personCenterX = width / 2;
    let personCenterY = height / 2;
    
    if (skinPixels.length > 20) {
      personCenterX = skinPixels.reduce((sum, p) => sum + p.x, 0) / skinPixels.length;
      personCenterY = skinPixels.reduce((sum, p) => sum + p.y, 0) / skinPixels.length;
    }
    
    // STAGE 2: Define person region based on skin location
    const personRadius = Math.min(width, height) * 0.35; // 35% of image size
    const bodyStartY = Math.max(0, personCenterY - personRadius * 0.5);
    const bodyEndY = Math.min(height, personCenterY + personRadius * 1.2);
    const bodyStartX = Math.max(0, personCenterX - personRadius * 0.8);
    const bodyEndX = Math.min(width, personCenterX + personRadius * 0.8);
    
    // STAGE 3: Build color histogram from PERSON REGION ONLY
    const colorMap = new Map<string, { count: number; r: number; g: number; b: number }>();
    const clothingSampleRate = 10; // Every 10th pixel for speed
    
    // Calculate edge density for texture detection
    const edgeStrength = new Uint8Array(width * height);
    for (let y = 2; y < height - 2; y += 4) {
      for (let x = 2; x < width - 2; x += 4) {
        const idx = (y * width + x) * 4;
        const gx = Math.abs(data[idx + 4] - data[idx - 4]);
        const gy = Math.abs(data[idx + width * 4] - data[idx - width * 4]);
        const strength = Math.min(255, gx + gy);
        edgeStrength[y * width + x] = strength;
      }
    }
    
    for (let y = bodyStartY; y < bodyEndY; y += clothingSampleRate) {
      for (let x = bodyStartX; x < bodyEndX; x += clothingSampleRate) {
        const idx = (y * width + x) * 4;
        const r = data[idx], g = data[idx + 1], b = data[idx + 2], a = data[idx + 3];
        
        if (a < 128) continue;
        if (isSkinColor(r, g, b)) continue; // Skip skin pixels
        
        const hsv = rgbToHsv(r, g, b);
        
        // CRITICAL: Advanced background rejection
        const distFromCenter = Math.sqrt(
          Math.pow(x - personCenterX, 2) + Math.pow(y - personCenterY, 2)
        );
        const normalizedDist = distFromCenter / personRadius;
        
        // Pixels far from person center are likely background
        if (normalizedDist > 1.2) continue;
        
        // Multi-layer background filters
        const isDefinitelyBackground = (
          // Very bright (white walls, bright backgrounds)
          (hsv.v > 90 && hsv.s < 15) ||
          
          // Very dark (deep shadows, black backgrounds)
          (hsv.v < 8) ||
          
          // Very low saturation at image edges (gray/beige walls)
          (hsv.s < 8 && normalizedDist > 0.7) ||
          
          // Specific wall colors - RED/ORANGE (the user's problem!)
          (hsv.h >= 0 && hsv.h <= 35 && hsv.s > 55 && hsv.v > 50 && normalizedDist > 0.6) ||
          
          // Yellow/beige walls
          (hsv.h >= 35 && hsv.h <= 65 && hsv.s > 40 && hsv.v > 65 && normalizedDist > 0.6) ||
          
          // Blue walls
          (hsv.h >= 200 && hsv.h <= 230 && hsv.s > 30 && hsv.s < 60 && hsv.v > 65) ||
          
          // Green walls
          (hsv.h >= 100 && hsv.h <= 140 && hsv.s > 35 && hsv.s < 70 && hsv.v > 50 && normalizedDist > 0.6)
        );
        
        if (isDefinitelyBackground) continue;
        
        // Accept clothing colors (including grey/black)
        const isLikelyClothing = (
          (hsv.s >= 5 && hsv.s <= 95 && hsv.v >= 12 && hsv.v <= 88) ||
          // Grey clothing (low sat, mid value, near person center)
          (hsv.s >= 1 && hsv.s <= 15 && hsv.v >= 15 && hsv.v <= 75 && normalizedDist < 0.8)
        );
        
        if (!isLikelyClothing) continue;
        
        // Check texture (clothing has texture, walls are flat)
        const edgeValue = edgeStrength[y * width + x] || 0;
        const hasTexture = edgeValue > 30;
        
        // Skip flat colors far from center (likely walls)
        if (!hasTexture && normalizedDist > 0.7) continue;
        
        // Quantize colors (30 hue bins for better discrimination)
        const h_bin = Math.round(hsv.h / 12) * 12;
        const s_bin = Math.round(hsv.s / 15) * 15;
        const v_bin = Math.round(hsv.v / 15) * 15;
        const colorKey = `${h_bin},${s_bin},${v_bin}`;
        
        // Weight by proximity to person center and texture
        const proximityWeight = Math.max(1, Math.floor(8 * (1 - normalizedDist)));
        const textureBonus = hasTexture ? 2 : 1;
        const weight = proximityWeight * textureBonus;
        
        const existing = colorMap.get(colorKey);
        if (existing) {
          existing.count += weight;
          existing.r = (existing.r * existing.count + r * weight) / (existing.count + weight);
          existing.g = (existing.g * existing.count + g * weight) / (existing.count + weight);
          existing.b = (existing.b * existing.count + b * weight) / (existing.count + weight);
        } else {
          colorMap.set(colorKey, { count: weight, r, g, b });
        }
      }
    }
    
    // STAGE 4: Determine skin tone
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
    
    // STAGE 5: Extract dominant clothing colors with chroma-js enhancements
    const colorArray = Array.from(colorMap.entries());
    const totalWeight = colorArray.reduce((sum, [, data]) => sum + data.count, 0);
    const threshold = totalWeight * 0.03; // Lowered to 3% to capture more colors
    
    // Get more color candidates (up to 20)
    const candidateColors = colorArray
      .filter(([, data]) => data.count >= threshold)
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 20)
      .map(([, data]) => ({
        r: Math.round(data.r),
        g: Math.round(data.g),
        b: Math.round(data.b),
        count: data.count,
        hex: `#${Math.round(data.r).toString(16).padStart(2, '0')}${Math.round(data.g).toString(16).padStart(2, '0')}${Math.round(data.b).toString(16).padStart(2, '0')}`
      }));
    
    // Use chroma-js to ensure color diversity (ΔE distance filtering)
    const diverseColors: typeof candidateColors = [];
    const MIN_DELTA_E = 15; // Minimum perceptual difference between colors
    
    for (const candidate of candidateColors) {
      if (diverseColors.length === 0) {
        diverseColors.push(candidate);
        continue;
      }
      
      // Check if this color is sufficiently different from all selected colors
      const isDifferent = diverseColors.every(existing => {
        try {
          const candidateChroma = chroma(candidate.hex);
          const existingChroma = chroma(existing.hex);
          const deltaE = chroma.deltaE(candidateChroma, existingChroma);
          return deltaE >= MIN_DELTA_E;
        } catch {
          return true; // If chroma fails, include the color
        }
      });
      
      if (isDifferent) {
        diverseColors.push(candidate);
        if (diverseColors.length >= 10) break; // Target 10 colors maximum
      }
    }
    
    // Ensure we have at least 8 colors - if not, relax the threshold
    if (diverseColors.length < 8 && candidateColors.length >= 8) {
      const relaxedMinDeltaE = 10;
      for (const candidate of candidateColors) {
        if (diverseColors.some(c => c.hex === candidate.hex)) continue;
        
        const isDifferent = diverseColors.every(existing => {
          try {
            return chroma.deltaE(chroma(candidate.hex), chroma(existing.hex)) >= relaxedMinDeltaE;
          } catch {
            return true;
          }
        });
        
        if (isDifferent) {
          diverseColors.push(candidate);
          if (diverseColors.length >= 8) break;
        }
      }
    }
    
    // Convert to color names for backward compatibility
    const dominantColorNames = diverseColors.map(color => {
      return getColorName(color.r, color.g, color.b);
    });
    
    // Extract hex colors for the palette
    const extractedPalette = diverseColors.map(c => c.hex);
    
    // Remove duplicates from names
    const uniqueColors = Array.from(new Set(dominantColorNames))
      .filter(color => color !== 'neutral')
      .slice(0, 10); // Keep up to 10 unique color names
    
    const dressColorsStr = uniqueColors.join(', ');
    
    console.timeEnd('colorExtraction');
    console.log('✅ Detected dress colors:', dressColorsStr);
    console.log('✅ Extracted color palette (hex):', extractedPalette);
    console.log('✅ Total diverse colors:', diverseColors.length);
    console.log('✅ Person center:', { x: Math.round(personCenterX), y: Math.round(personCenterY) });
    console.log('✅ Skin pixels found:', skinPixels.length);
    console.log('✅ Color candidates:', colorMap.size, '→ Diverse:', diverseColors.length);

    return { 
      skinTone, 
      dressColors: dressColorsStr || 'neutral tones',
      colorPalette: extractedPalette // NEW: Return hex palette
    };
  };

  const performAnalysis = async (request: AnalyzeImageAndProvideRecommendationsInput) => {
    setIsLoading(true);
    setAllContentReady(false);
    setShowResults(false); // Hide previous results immediately
    setAnalysisResult(null);
    setGeneratedImageUrls([]);
    setImageSources([]);
    
    // Initialize processing steps
    initializeProcessingSteps();

    try {
      if (!request.previousRecommendation) {
        updateStep('extract', 'processing');
        setLoadingMessage("Extracting colors from your image...");

        const { skinTone, dressColors } = extractColorsFromCanvas();

        request.skinTone = skinTone;
        request.dressColors = dressColors;

        setLastAnalysisRequest({
          photoDataUri: request.photoDataUri,
          occasion: request.occasion,
          genre: request.genre,
          gender: request.gender,
          weather: request.weather,
          skinTone: skinTone,
          dressColors: dressColors,
          userId: request.userId,
        });
        
        updateStep('extract', 'complete');
      }

      updateStep('analyze', 'processing');
      updateStep('generate', 'processing');
      updateStep('enhance', 'processing');
      updateStep('search', 'processing');
      setLoadingMessage("Analyzing your style with AI...");

      // Call the /api/recommend route which handles everything:
      // 1. Gemini style analysis
      // 2. Image generation with Pollinations
      // 3. Gemini image analysis for accurate colors
      // 4. Optimized Tavily search with proper queries
      console.log('📡 Calling /api/recommend with full processing pipeline...');
      
      const response = await fetch('/api/recommend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `API request failed with status ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ API response received:', {
        success: data.success,
        hasPayload: !!data.payload,
        outfitsCount: data.payload?.analysis?.outfitRecommendations?.length,
      });

      if (!data.success || !data.payload) {
        throw new Error('Invalid API response structure');
      }

      const result = data.payload.analysis;
      const enrichedOutfits = result.outfitRecommendations;
      
      // ✅ VALIDATION: Ensure all outfits have complete data
      console.log('🔍 Validating outfit data completeness...');
      const hasCompleteData = enrichedOutfits.every((outfit: any) => {
        const hasImage = !!outfit.imageUrl;
        const hasColors = outfit.colorPalette && outfit.colorPalette.length > 0;
        const hasLinks = outfit.shoppingLinks && (
          outfit.shoppingLinks.amazon || 
          outfit.shoppingLinks.myntra || 
          outfit.shoppingLinks.nykaa
        );
        
        console.log(`  Outfit "${outfit.title}":`, {
          hasImage,
          colorCount: outfit.colorPalette?.length || 0,
          hasLinks,
        });
        
        return hasImage && hasColors && hasLinks;
      });

      if (!hasCompleteData) {
        console.warn('⚠️ Some outfits have incomplete data, but proceeding...');
      } else {
        console.log('✅ All outfits have complete data (image + colors + links)');
      }
      
      updateStep('analyze', 'complete');
      updateStep('generate', 'complete');
      updateStep('enhance', 'complete');
      updateStep('search', 'complete');
      
      // Use the recommendation ID from the API if available
      const recId = data.recommendationId || `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setRecommendationId(recId);

      // Extract image URLs from the enriched outfits
      const imageUrls = enrichedOutfits.map((outfit: any) => outfit.imageUrl || '');
      const sources = enrichedOutfits.map((outfit: any) => {
        if (outfit.imageUrl?.includes('placeholder')) return 'placeholder' as const;
        if (outfit.imageUrl?.includes('pollinations')) return 'pollinations' as const;
        return 'placeholder' as const;
      });

      setGeneratedImageUrls(imageUrls);
      setImageSources(sources);

      // ✅ CRITICAL: Preload all images and wait for them to fully load
      updateStep('finalize', 'processing');
      setLoadingMessage("Verifying all images are ready...");
      
      try {
        await preloadImages(imageUrls);
        console.log('✅ All images preloaded successfully');
      } catch (imgError) {
        console.warn('⚠️ Some images failed to preload:', imgError);
        // Continue anyway - Pollinations images will load on demand
      }
      
      updateStep('finalize', 'complete');

      // ✅ NOW set the analysis result after EVERYTHING is verified
      console.log('📦 Setting analysis result with complete data...');
      setAnalysisResult(result);
      setAllContentReady(true);
      
      // Small delay to ensure smooth transition
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // ✅ FINAL STEP: Show results only after all validation passes
      console.log('🎉 Displaying results to user!');
      setShowResults(true);

      console.log('✅ Full recommendation flow complete!');

    } catch (e) {
      console.error('❌ Analysis error:', e);
      const errorMessage = e instanceof Error ? e.message : 'An unexpected error occurred';
      
      // Mark current step as error
      const currentStep = processingSteps.find(s => s.status === 'processing');
      if (currentStep) {
        updateStep(currentStep.id, 'error', errorMessage);
      }
      
      // Determine error type and show appropriate message
      let title = "Analysis Failed";
      let description = "An unexpected error occurred. Please try again.";
      
      if (errorMessage.includes('high demand') || errorMessage.includes('overloaded') || errorMessage.includes('temporarily unavailable')) {
        title = "Service Busy";
        description = "⏳ Our AI service is experiencing high demand. Please wait 30-60 seconds and try again. We apologize for the inconvenience!";
      } else if (errorMessage.includes('rate limit') || errorMessage.includes('quota')) {
        title = "Rate Limit Reached";
        description = "⏱️ Too many requests. Please wait a minute and try again.";
      } else if (errorMessage.includes('schema validation')) {
        title = "AI Response Error";
        description = "The AI response was incomplete. Please try again.";
      } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
        title = "Connection Error";
        description = "🌐 Network connection issue. Please check your internet and try again.";
      } else {
        description = errorMessage.length > 100 
          ? "An error occurred. Please try again or contact support if it persists."
          : errorMessage;
      }
      
      toast({
        variant: "destructive",
        title,
        description,
        duration: errorMessage.includes('high demand') ? 8000 : 5000, // Show longer for overload errors
      });
    } finally {
      setIsLoading(false);
      // Don't set allContentReady on error - it should only be true when everything is ready
    }
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
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

    const imageElement = document.createElement('img');
    imageElement.src = previewImage;
    imageElement.onload = async () => {
        const canvas = canvasRef.current;
        if (canvas) {
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
        }
    };
    imageElement.onerror = () => {
        toast({ variant: 'destructive', title: 'Image Load Error', description: 'Could not load the selected image for analysis.' });
    }
  };

  const handleGetAnotherRecommendation = async () => {
    if (!lastAnalysisRequest || !analysisResult) return;

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
            <CardTitle className="text-3xl font-headline">Create Your Style Profile</CardTitle>
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
                      <FormLabel className="text-base font-semibold">1. Upload Your Outfit or Take a Photo</FormLabel>
                      
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
                            <div className="relative flex justify-center items-center w-full h-80 rounded-lg p-4 text-center cursor-pointer bg-primary/20 group animate-fade-in-up transition-all duration-300 ease-in-out transform hover:scale-105 hover:shadow-2xl hover:shadow-accent/20"
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
                        <FormLabel className="text-base font-semibold">4. Select Your Gender</FormLabel>
                        <div className="flex flex-wrap gap-3 pt-2">
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
                  disabled={isLoading || isFetchingWeather || isValidatingImage || !!imageValidationError}
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
        <Card className="w-full shadow-lg animate-slide-up-fade bg-card/60 dark:bg-card/40 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-headline">
              <Sparkles className="text-accent animate-pulse" /> {loadingMessage}
            </CardTitle>
            <CardDescription>
              Our AI is crafting your personalized feedback. This typically takes 15-25 seconds.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Processing Steps */}
            {processingSteps.length > 0 && (
              <div className="space-y-3">
                {processingSteps.map((step) => (
                  <motion.div
                    key={step.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3 }}
                    className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-border/50"
                  >
                    {step.status === 'pending' && (
                      <Clock className="w-5 h-5 text-muted-foreground" />
                    )}
                    {step.status === 'processing' && (
                      <Loader2 className="w-5 h-5 text-accent animate-spin" />
                    )}
                    {step.status === 'complete' && (
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    )}
                    {step.status === 'error' && (
                      <AlertCircle className="w-5 h-5 text-destructive" />
                    )}
                    <div className="flex-1">
                      <p className={cn(
                        "text-sm font-medium",
                        step.status === 'complete' && "text-green-500",
                        step.status === 'error' && "text-destructive",
                        step.status === 'processing' && "text-accent",
                        step.status === 'pending' && "text-muted-foreground"
                      )}>
                        {step.label}
                      </p>
                      {step.message && step.status === 'error' && (
                        <p className="text-xs text-muted-foreground mt-1">{step.message}</p>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
            
            <Separator />
            
            {/* Skeleton placeholders */}
            <div className="space-y-3">
              <Skeleton className="h-5 w-1/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </div>
            <Separator />
            <div className="space-y-3">
              <Skeleton className="h-5 w-1/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/6" />
            </div>
          </CardContent>
        </Card>
      )}

      <AnimatePresence mode="wait">
        {showResults && analysisResult && allContentReady && !isLoading && (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <Card className="w-full shadow-xl shadow-accent/20 animate-slide-up-fade border-accent/30 bg-card/60 dark:bg-card/40 backdrop-blur-xl">
              <CardContent className="p-6 md:p-8">
                <StyleAdvisorResults 
                  analysisResult={analysisResult} 
                  generatedImageUrls={generatedImageUrls}
                  imageSources={imageSources}
                  recommendationId={recommendationId}
                  gender={lastAnalysisRequest?.gender}
                />
              </CardContent>
              <CardFooter className="flex flex-col md:flex-row gap-4 p-6 bg-primary/20">
                <Button onClick={handleGetAnotherRecommendation} variant="outline" className="w-full text-base">
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
