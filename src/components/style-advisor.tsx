"use client";

import * as React from "react";
import Image from "next/image";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Loader2, Sparkles, UploadCloud, RefreshCw } from "lucide-react";

import { analyzeImageAndProvideRecommendations, type AnalyzeImageAndProvideRecommendationsInput } from "@/ai/flows/analyze-image-and-provide-recommendations";
import { extractColorsFromImage } from "@/ai/flows/extract-colors-from-image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { getWeatherData } from "@/app/actions";

const formSchema = z.object({
  image: z
    .any()
    .refine((files) => files?.length === 1, "An image of your outfit is required.")
    .refine((files) => files?.[0]?.size <= 10000000, `Max file size is 10MB.`),
  occasion: z.string({ required_error: "Please select an occasion." }).min(1),
  gender: z.string({ required_error: "Please select a gender." }).min(1),
});

type AnalysisRequest = Omit<AnalyzeImageAndProvideRecommendationsInput, 'previousRecommendation'>;

export function StyleAdvisor() {
  const { toast } = useToast();
  const [weather, setWeather] = React.useState<string | null>(null);
  const [isFetchingWeather, setIsFetchingWeather] = React.useState(true);
  const [analysisResult, setAnalysisResult] = React.useState<{ analysis: string; recommendation: string; } | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [loadingMessage, setLoadingMessage] = React.useState("Analyzing Your Style...");
  const [previewImage, setPreviewImage] = React.useState<string | null>(null);
  const [lastAnalysisRequest, setLastAnalysisRequest] = React.useState<AnalysisRequest | null>(null);


  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      occasion: "",
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
          console.error("Failed to fetch weather data", error);
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
        // Don't log error if user denied permission, the toast is enough.
        if (geoError.code !== geoError.PERMISSION_DENIED) {
          // console.error("Geolocation error:", geoError.message);
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
  };

  const performAnalysis = async (request: AnalyzeImageAndProvideRecommendationsInput) => {
    setIsLoading(true);
    setAnalysisResult(null);

    try {
      // Don't extract colors again if we are just getting a new recommendation
      if (!request.previousRecommendation) {
        setLoadingMessage("Extracting colors from your image...");
        const { skinTone, dressColors } = await extractColorsFromImage({ photoDataUri: request.photoDataUri });

        request.skinTone = skinTone;
        request.dressColors = dressColors;
        
        // Save the request details for re-tries
        setLastAnalysisRequest({
          photoDataUri: request.photoDataUri,
          occasion: request.occasion,
          gender: request.gender,
          weather: request.weather,
          skinTone: skinTone,
          dressColors: dressColors,
        });
      }

      setLoadingMessage("Getting your style recommendations...");
      const result = await analyzeImageAndProvideRecommendations(request);
      setAnalysisResult(result);
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

    const file = values.image[0];
    const reader = new FileReader();

    reader.onload = async () => {
      const photoDataUri = reader.result as string;
      await performAnalysis({
        photoDataUri,
        occasion: values.occasion,
        gender: values.gender,
        weather: weather,
        skinTone: '', // Will be populated in performAnalysis
        dressColors: '', // Will be populated in performAnalysis
      });
    };

    reader.onerror = () => {
      toast({
        variant: "destructive",
        title: "File Read Error",
        description: "Could not read the selected image file.",
      });
    };

    reader.readAsDataURL(file);
  };

  const handleGetAnotherRecommendation = async () => {
    if (!lastAnalysisRequest || !analysisResult) return;
    
    await performAnalysis({
      ...lastAnalysisRequest,
      previousRecommendation: analysisResult.recommendation,
    });
  };

  return (
    <div className="space-y-12">
      <Card className="w-full shadow-2xl shadow-primary/10 border-border/20 animate-slide-up-fade bg-card/60 dark:bg-card/40 backdrop-blur-xl">
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
                    <FormLabel className="text-base font-semibold">Your Outfit</FormLabel>
                    <FormControl>
                      <div className="relative flex justify-center items-center w-full h-64 border-2 border-dashed border-muted-foreground/30 rounded-lg p-4 text-center hover:border-accent hover:bg-accent/10 transition-all duration-300 cursor-pointer bg-primary/5 group">
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
                            className="object-contain rounded-md"
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <FormField
                  control={form.control}
                  name="occasion"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base font-semibold">Occasion</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="text-base transition-all duration-300 hover:border-primary focus:ring-primary">
                            <SelectValue placeholder="Select an occasion" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Casual">Casual</SelectItem>
                          <SelectItem value="Formal">Formal</SelectItem>
                          <SelectItem value="Party">Party</SelectItem>
                          <SelectItem value="Work">Work</SelectItem>
                          <SelectItem value="Workout">Workout</SelectItem>
                          <SelectItem value="Date Night">Date Night</SelectItem>
                          <SelectItem value="Wedding Guest">Wedding Guest</SelectItem>
                          <SelectItem value="Vacation">Vacation</SelectItem>
                          <SelectItem value="Weekend Brunch">Weekend Brunch</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="gender"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base font-semibold">Gender</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="text-base transition-all duration-300 hover:border-primary focus:ring-primary">
                            <SelectValue placeholder="Select a gender" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Male">Male</SelectItem>
                          <SelectItem value="Female">Female</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <Button type="submit" size="lg" className="w-full text-lg font-bold bg-gradient-to-r from-primary to-accent text-white hover:shadow-lg hover:shadow-primary/30 transition-all duration-300 hover:scale-105" disabled={isLoading || isFetchingWeather}>
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
        <Card className="w-full shadow-xl shadow-accent/10 animate-slide-up-fade border-accent/30 bg-card/60 dark:bg-card/40 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-3xl font-headline">
              <Sparkles className="w-8 h-8 text-accent" /> Your Style Analysis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-8 text-base">
            <div>
              <h3 className="font-bold text-2xl mb-3 text-foreground tracking-tight font-headline">Feedback on Your Outfit</h3>
              <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">{analysisResult.analysis}</p>
            </div>
            <Separator />
            <div>
              <h3 className="font-bold text-2xl mb-3 text-foreground tracking-tight font-headline">Recommendations</h3>
              <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">{analysisResult.recommendation}</p>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col md:flex-row gap-4">
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
