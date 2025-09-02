"use client";

import * as React from "react";
import Image from "next/image";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Loader2, Sparkles, UploadCloud, RefreshCw, Wand2, User } from "lucide-react";

import { analyzeImageAndProvideRecommendations, type AnalyzeImageAndProvideRecommendationsInput, type AnalyzeImageAndProvideRecommendationsOutput } from "@/ai/flows/analyze-image-and-provide-recommendations";
import { generateOutfitImage } from "@/ai/flows/generate-outfit-image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { getWeatherData } from "@/app/actions";
import { cn } from "@/lib/utils";
import { StyleAdvisorResults } from "./style-advisor-results";

const genders = [
  { value: "Male", label: "Male" },
  { value: "Female", label: "Female" },
  { value: "Neutral", label: "Neutral" },
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

// Helper function to calculate color distance
function colorDistance(color1: number[], color2: number[]): number {
  return Math.sqrt(
    Math.pow(color1[0] - color2[0], 2) +
    Math.pow(color1[1] - color2[1], 2) +
    Math.pow(color1[2] - color2[2], 2)
  );
}

// Simple skin tone detection (heuristic)
function isSkinColor(r: number, g: number, b: number): boolean {
  return r > 95 && g > 40 && b > 20 &&
         r > g && r > b &&
         Math.max(r, g, b) - Math.min(r, g, b) > 15 &&
         Math.abs(r - g) > 15;
}

export function StyleAdvisor() {
  const { toast } = useToast();
  const [weather, setWeather] = React.useState<string | null>(null);
  const [isFetchingWeather, setIsFetchingWeather] = React.useState(true);
  const [analysisResult, setAnalysisResult] = React.useState<AnalyzeImageAndProvideRecommendationsOutput | null>(null);
  const [generatedImageUrl, setGeneratedImageUrl] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [loadingMessage, setLoadingMessage] = React.useState("Analyzing Your Style...");
  const [previewImage, setPreviewImage] = React.useState<string | null>(null);
  const [lastAnalysisRequest, setLastAnalysisRequest] = React.useState<AnalysisRequest | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);


  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      occasion: "",
      genre: "",
      gender: "",
    },
  });

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

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setPreviewImage(null);
    }
  };
  
  const resetForm = () => {
    form.reset();
    setPreviewImage(null);
    setAnalysisResult(null);
    setLastAnalysisRequest(null);
    setGeneratedImageUrl(null);
  };

  const extractColorsFromCanvas = (): { skinTone: string; dressColors: string; } => {
    const canvas = canvasRef.current;
    if (!canvas) return { skinTone: "not detected", dressColors: "not detected" };
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return { skinTone: "not detected", dressColors: "not detected" };

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const colorCounts: { [key: string]: number } = {};
    let skinTonePixels: number[][] = [];

    // Top 25% of the image for skin tone
    const skinAreaHeight = canvas.height * 0.25;
    const skinAreaWidth = canvas.width * 0.5;
    const skinAreaX = canvas.width * 0.25;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const y = Math.floor(i / 4 / canvas.width);
      const x = (i / 4) % canvas.width;

      if(isSkinColor(r,g,b)) {
        // Check if pixel is in the upper-middle region
        if (y < skinAreaHeight && x > skinAreaX && x < skinAreaX + skinAreaWidth) {
            skinTonePixels.push([r, g, b]);
        }
      } else {
        // Simplified color binning for dress colors
        const r_bin = Math.floor(r / 32) * 32;
        const g_bin = Math.floor(g / 32) * 32;
        const b_bin = Math.floor(b / 32) * 32;
        const colorKey = `${r_bin},${g_bin},${b_bin}`;
        colorCounts[colorKey] = (colorCounts[colorKey] || 0) + 1;
      }
    }
    
    // Determine skin tone
    let skinTone = "fair";
    if (skinTonePixels.length > 0) {
        const avgSkin = skinTonePixels.reduce((acc, val) => [acc[0] + val[0], acc[1] + val[1], acc[2] + val[2]], [0,0,0]).map(c => c / skinTonePixels.length);
        const avgLuminance = (0.299 * avgSkin[0] + 0.587 * avgSkin[1] + 0.114 * avgSkin[2]);
        if (avgLuminance < 80) skinTone = "dark";
        else if (avgLuminance < 160) skinTone = "olive";
        else skinTone = "fair";
    }

    // Get dominant dress colors
    const sortedColors = Object.entries(colorCounts).sort(([, a], [, b]) => b - a);
    const dominantColors = sortedColors.slice(0, 3).map(([key]) => key);
    
    const dressColorsStr = dominantColors.map(colorKey => {
      const rgb = colorKey.split(',').map(Number);
      // A simple mapping for demo
      if (colorDistance(rgb, [0,0,0]) < 80) return 'black';
      if (colorDistance(rgb, [255,255,255]) < 80) return 'white';
      if (colorDistance(rgb, [128,128,128]) < 80) return 'gray';
      if (rgb[0] > 150 && rgb[1] < 100 && rgb[2] < 100) return 'red';
      if (rgb[1] > 150 && rgb[0] < 100 && rgb[2] < 100) return 'green';
      if (rgb[2] > 150 && rgb[0] < 100 && rgb[1] < 100) return 'blue';
      return 'neutral';
    }).join(', ');
    
    return { skinTone, dressColors: dressColorsStr || 'not detected' };
  };
  
  const performAnalysis = async (request: AnalyzeImageAndProvideRecommendationsInput) => {
    setIsLoading(true);
    setAnalysisResult(null);
    setGeneratedImageUrl(null);

    try {
      if (!request.previousRecommendation) {
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
        });
      }

      setLoadingMessage("Getting your style recommendations...");
      const result = await analyzeImageAndProvideRecommendations(request);
      setAnalysisResult(result);
      
      setLoadingMessage("Generating outfit image...");
      const imageResult = await generateOutfitImage({ outfitDescription: result.imagePrompt });
      setGeneratedImageUrl(imageResult.imageUrl);

    } catch (e) {
      console.error(e);
      toast({
        variant: "destructive",
        title: "Analysis Failed",
        description: "An unexpected error occurred. Please try again later.",
      });
    } finally {
      setIsLoading(false);
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

    const imageElement = document.createElement('img');
    imageElement.src = previewImage;
    imageElement.onload = async () => {
        const canvas = canvasRef.current;
        if (canvas) {
            canvas.width = imageElement.width;
            canvas.height = imageElement.height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(imageElement, 0, 0);
            
            await performAnalysis({
              photoDataUri: previewImage,
              occasion: values.occasion,
              genre: values.genre,
              gender: values.gender,
              weather: weather,
              skinTone: '', 
              dressColors: '',
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
      
      {!analysisResult && !isLoading && (
        <Card className="w-full shadow-2xl shadow-accent/20 border-border/20 animate-slide-up-fade bg-card/60 dark:bg-card/40 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-3xl font-headline">Create Your Style Profile</CardTitle>
            <CardDescription>
              Tell us a bit about your look, and our AI will provide personalized feedback.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <FormField
                  control={form.control}
                  name="image"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base font-semibold">1. Upload Your Outfit</FormLabel>
                      <FormControl>
                        <div className="relative flex justify-center items-center w-full h-80 rounded-lg p-4 text-center cursor-pointer bg-primary/20 group animate-fade-in-up transition-all duration-300 ease-in-out transform hover:scale-105 hover:shadow-2xl hover:shadow-accent/20"
                            style={{
                              border: "2px dashed hsl(var(--border))",
                              boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05), inset 0 0 10px 5px rgba(255,255,255,0.05)"
                            }}>
                          <Input
                            type="file"
                            accept="image/*"
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            onChange={(e) => {
                              field.onChange(e.target.files);
                              handleImageChange(e);
                            }}
                          />
                          {previewImage ? (
                            <Image
                              src={previewImage}
                              alt="Outfit preview"
                              fill
                              className="object-contain rounded-md p-2"
                              data-ai-hint="person outfit"
                            />
                          ) : (
                            <div className="flex flex-col items-center justify-center space-y-2 text-muted-foreground group-hover:text-accent transition-colors">
                              <UploadCloud className="w-12 h-12 text-accent/80 group-hover:text-accent transition-colors" />
                              <p className="font-semibold">Click to upload or drag and drop</p>
                              <p className="text-xs">PNG, JPG up to 10MB</p>
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

                <Button type="submit" size="lg" className="w-full text-lg font-bold bg-gradient-to-r from-accent to-primary text-primary-foreground hover:shadow-lg hover:shadow-accent/30 transition-all duration-300 hover:scale-105" disabled={isLoading || isFetchingWeather}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      {loadingMessage}
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
            <CardDescription>Our AI is crafting your personalized feedback. This might take a moment.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
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

      {analysisResult && !isLoading && (
         <Card className="w-full shadow-xl shadow-accent/20 animate-slide-up-fade border-accent/30 bg-card/60 dark:bg-card/40 backdrop-blur-xl">
          <CardContent className="p-6 md:p-8">
             <StyleAdvisorResults 
                analysisResult={analysisResult} 
                generatedImageUrl={generatedImageUrl}
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
      )}
    </div>
  );
}
