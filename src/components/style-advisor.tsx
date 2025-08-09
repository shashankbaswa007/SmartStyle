"use client";

import * as React from "react";
import Image from "next/image";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Loader2, Sparkles, UploadCloud } from "lucide-react";

import { analyzeCurrentOutfitAndProvideFeedback, type OutfitAnalysisOutput } from "@/ai/flows/analyze-current-outfit-and-provide-feedback";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

export function StyleAdvisor() {
  const { toast } = useToast();
  const [weather, setWeather] = React.useState<string | null>(null);
  const [isFetchingWeather, setIsFetchingWeather] = React.useState(true);
  const [analysisResult, setAnalysisResult] = React.useState<OutfitAnalysisOutput | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [previewImage, setPreviewImage] = React.useState<string | null>(null);

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
          toast({
            title: "Location detected",
            description: "Using your current location for accurate weather.",
          });
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
        console.error("Geolocation error:", geoError.message);
        setWeather("Clear skies, around 25°C");
        toast({
          variant: "default",
          title: "Could not access location",
          description: "Using default weather. For better results, enable location access.",
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
      setIsLoading(true);
      setAnalysisResult(null);

      try {
        const result = await analyzeCurrentOutfitAndProvideFeedback({
          photoDataUri,
          occasion: values.occasion,
          gender: values.gender,
          weatherInfo: weather,
        });
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

    reader.onerror = () => {
      toast({
        variant: "destructive",
        title: "File Read Error",
        description: "Could not read the selected image file.",
      });
    };

    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-12">
      <Card className="w-full shadow-lg border-primary/20">
        <CardHeader>
          <CardTitle>Create Your Style Profile</CardTitle>
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
                    <FormLabel className="text-base">Your Outfit</FormLabel>
                    <FormControl>
                      <div className="relative flex justify-center items-center w-full h-64 border-2 border-dashed border-muted-foreground/50 rounded-lg p-4 text-center hover:border-accent transition-colors cursor-pointer bg-primary/20">
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
                          <div className="flex flex-col items-center justify-center space-y-2 text-muted-foreground">
                            <UploadCloud className="w-12 h-12 text-accent" />
                            <p>Click to upload or drag and drop</p>
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
                      <FormLabel className="text-base">Occasion</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select an occasion" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Casual">Casual</SelectItem>
                          <SelectItem value="Formal">Formal</SelectItem>
                          <SelectItem value="Party">Party</SelectItem>
                          <SelectItem value="Work">Work</SelectItem>
                          <SelectItem value="Workout">Workout</SelectItem>
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
                      <FormLabel className="text-base">Gender</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
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
              <Button type="submit" size="lg" className="w-full bg-accent text-accent-foreground hover:bg-accent/90" disabled={isLoading || isFetchingWeather}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Analyzing...
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
        <Card className="w-full shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="text-accent animate-pulse" /> Analyzing Your Style...
            </CardTitle>
            <CardDescription>Our AI is crafting your personalized feedback. This might take a moment.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Skeleton className="h-5 w-1/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </div>
            <Separator />
            <div className="space-y-2">
              <Skeleton className="h-5 w-1/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/6" />
            </div>
          </CardContent>
        </Card>
      )}

      {analysisResult && !isLoading && (
        <Card className="w-full shadow-lg animate-fade-in border-accent/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-2xl">
              <Sparkles className="w-8 h-8 text-accent" /> Your Style Analysis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 text-base">
            <div>
              <h3 className="font-semibold text-xl mb-2 text-foreground">Feedback on Your Outfit</h3>
              <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">{analysisResult.feedback}</p>
            </div>
            <Separator />
            <div>
              <h3 className="font-semibold text-xl mb-2 text-foreground">Recommendations</h3>
              <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">{analysisResult.recommendations}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
