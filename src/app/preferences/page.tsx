"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { 
  Palette, 
  Shirt, 
  Calendar, 
  Sun, 
  ShoppingBag, 
  TrendingUp,
  Ban,
  Settings,
  Download,
  RefreshCw,
  Loader2,
  Heart,
  Target,
  Sparkles,
  Eye
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface UserPreferences {
  colorProfiles: Record<string, number>;
  styleProfiles: Record<string, number>;
  occasionProfiles: Record<string, number>;
  seasonalProfiles: Record<string, number>;
  totalLikes: number;
  totalWears: number;
  totalShoppingClicks: number;
  lastUpdated: number | null;
}

interface BlocklistData {
  hardBlocklist: {
    colors: string[];
    styles: string[];
    items: string[];
  };
  softBlocklist: {
    colors: string[];
    styles: string[];
    items: string[];
  };
  temporaryBlocklist: Array<{
    color?: string;
    style?: string;
    item?: string;
    expiresAt: number | null;
    reason: string;
  }>;
}

export default function PreferencesPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [blocklists, setBlocklists] = useState<BlocklistData | null>(null);
  const { toast } = useToast();

  const loadUserData = useCallback(async (userId: string) => {
    try {
      setLoading(true);
      
      // Load preferences
      const prefDoc = await getDoc(doc(db, "userPreferences", userId));
      if (prefDoc.exists()) {
        setPreferences(prefDoc.data() as UserPreferences);
      }

      // Load blocklists
      const blocklistDoc = await getDoc(doc(db, "userBlocklists", userId));
      if (blocklistDoc.exists()) {
        setBlocklists(blocklistDoc.data() as BlocklistData);
      }
    } catch (error) {
      console.error("Error loading preferences:", error);
      toast({
        title: "Error",
        description: "Failed to load your preferences",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        loadUserData(currentUser.uid);
      } else {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [loadUserData]);

  const resetPreferences = async () => {
    if (!user) return;
    
    // This would require a server action to safely reset preferences
    toast({
      title: "Feature Coming Soon",
      description: "Preference reset will be available in a future update",
    });
  };

  const exportData = () => {
    if (!preferences && !blocklists) {
      toast({
        title: "No Data",
        description: "No preference data to export",
      });
      return;
    }

    const data = {
      preferences,
      blocklists,
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `smartstyle-preferences-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Exported!",
      description: "Your preference data has been downloaded",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Sign In Required</CardTitle>
            <CardDescription>
              You need to sign in to view your style preferences
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => window.location.href = '/auth'} className="w-full">
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!preferences && !blocklists) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>No Preferences Yet</CardTitle>
            <CardDescription>
              Start using SmartStyle to build your personalized style profile!
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => window.location.href = '/style-check'} className="w-full">
              Get Started
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Calculate top items
  const topColors = preferences?.colorProfiles 
    ? Object.entries(preferences.colorProfiles)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
    : [];

  const topStyles = preferences?.styleProfiles
    ? Object.entries(preferences.styleProfiles)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 8)
    : [];

  const topOccasions = preferences?.occasionProfiles
    ? Object.entries(preferences.occasionProfiles)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 6)
    : [];

  const topSeasons = preferences?.seasonalProfiles
    ? Object.entries(preferences.seasonalProfiles)
        .sort(([, a], [, b]) => b - a)
    : [];

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-6xl mx-auto p-6 space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-2"
        >
          <h1 className="text-4xl font-bold text-foreground">Your Style Profile</h1>
          <p className="text-muted-foreground">
            SmartStyle learns from your preferences to provide personalized recommendations
          </p>
        </motion.div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button onClick={exportData} variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export Data
          </Button>
          <Button onClick={resetPreferences} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Reset Preferences
          </Button>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-pink-500/10">
                  <Heart className="w-6 h-6 text-pink-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{preferences?.totalLikes || 0}</p>
                  <p className="text-sm text-muted-foreground">Outfits Liked</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-green-500/10">
                  <Eye className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{preferences?.totalWears || 0}</p>
                  <p className="text-sm text-muted-foreground">Outfits Worn</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-blue-500/10">
                  <ShoppingBag className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{preferences?.totalShoppingClicks || 0}</p>
                  <p className="text-sm text-muted-foreground">Shopping Clicks</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="colors" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="colors">Colors</TabsTrigger>
            <TabsTrigger value="styles">Styles</TabsTrigger>
            <TabsTrigger value="occasions">Occasions</TabsTrigger>
            <TabsTrigger value="blocklists">Blocklists</TabsTrigger>
          </TabsList>

          {/* Colors Tab */}
          <TabsContent value="colors" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="w-5 h-5" />
                  Your Color Preferences
                </CardTitle>
                <CardDescription>
                  Colors you love, weighted by your interactions
                </CardDescription>
              </CardHeader>
              <CardContent>
                {topColors.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {topColors.map(([color, weight]) => (
                      <div key={color} className="flex flex-col items-center gap-2">
                        <div 
                          className="w-16 h-16 rounded-full border-2 border-border shadow-sm"
                          style={{ backgroundColor: color }}
                        />
                        <div className="text-center">
                          <p className="text-xs font-medium">{color}</p>
                          <Badge variant="secondary" className="mt-1 text-xs">
                            {weight} points
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    No color preferences yet. Like some outfits to build your profile!
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Seasonal Preferences */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sun className="w-5 h-5" />
                  Seasonal Preferences
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {topSeasons.map(([season, weight]) => (
                    <div key={season} className="p-4 rounded-lg border bg-card">
                      <p className="font-medium capitalize">{season}</p>
                      <p className="text-2xl font-bold text-accent">{weight}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Styles Tab */}
          <TabsContent value="styles" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shirt className="w-5 h-5" />
                  Your Style Personality
                </CardTitle>
                <CardDescription>
                  Fashion styles that resonate with you
                </CardDescription>
              </CardHeader>
              <CardContent>
                {topStyles.length > 0 ? (
                  <div className="space-y-3">
                    {topStyles.map(([style, weight]) => {
                      const maxWeight = topStyles[0][1];
                      const percentage = (weight / maxWeight) * 100;
                      
                      return (
                        <div key={style} className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="font-medium capitalize">{style}</span>
                            <Badge variant="outline">{weight} points</Badge>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2">
                            <div 
                              className="bg-accent h-2 rounded-full transition-all"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    No style preferences yet. Start exploring to build your profile!
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Occasions Tab */}
          <TabsContent value="occasions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Occasion Preferences
                </CardTitle>
                <CardDescription>
                  Events and occasions you dress for
                </CardDescription>
              </CardHeader>
              <CardContent>
                {topOccasions.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {topOccasions.map(([occasion, weight]) => (
                      <Card key={occasion}>
                        <CardContent className="pt-6">
                          <p className="font-medium capitalize mb-2">{occasion}</p>
                          <div className="flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-accent" />
                            <span className="text-2xl font-bold">{weight}</span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    No occasion preferences yet. Like outfits to build your profile!
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Blocklists Tab */}
          <TabsContent value="blocklists" className="space-y-4">
            <Alert>
              <Settings className="h-4 w-4" />
              <AlertTitle>Blocklist Management</AlertTitle>
              <AlertDescription>
                Items you&apos;ve blocked from recommendations. Manual blocklist editing coming soon!
              </AlertDescription>
            </Alert>

            {/* Hard Blocklist */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Ban className="w-5 h-5 text-red-600" />
                  Hard Blocklist (Never Show)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {blocklists?.hardBlocklist?.colors && blocklists.hardBlocklist.colors.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">Colors</h4>
                      <div className="flex flex-wrap gap-2">
                        {blocklists.hardBlocklist.colors.map((color, idx) => (
                          <Badge key={idx} variant="destructive">{color}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {blocklists?.hardBlocklist?.styles && blocklists.hardBlocklist.styles.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">Styles</h4>
                      <div className="flex flex-wrap gap-2">
                        {blocklists.hardBlocklist.styles.map((style, idx) => (
                          <Badge key={idx} variant="destructive" className="capitalize">{style}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {(!blocklists?.hardBlocklist?.colors || blocklists.hardBlocklist.colors.length === 0) &&
                   (!blocklists?.hardBlocklist?.styles || blocklists.hardBlocklist.styles.length === 0) && (
                    <p className="text-muted-foreground text-sm">No items blocked permanently</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Soft Blocklist */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Ban className="w-5 h-5 text-orange-600" />
                  Soft Blocklist (Show Rarely)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {blocklists?.softBlocklist?.colors && blocklists.softBlocklist.colors.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">Colors</h4>
                      <div className="flex flex-wrap gap-2">
                        {blocklists.softBlocklist.colors.map((color, idx) => (
                          <Badge key={idx} variant="outline" className="border-orange-500">{color}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {blocklists?.softBlocklist?.styles && blocklists.softBlocklist.styles.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">Styles</h4>
                      <div className="flex flex-wrap gap-2">
                        {blocklists.softBlocklist.styles.map((style, idx) => (
                          <Badge key={idx} variant="outline" className="border-orange-500 capitalize">{style}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {(!blocklists?.softBlocklist?.colors || blocklists.softBlocklist.colors.length === 0) &&
                   (!blocklists?.softBlocklist?.styles || blocklists.softBlocklist.styles.length === 0) && (
                    <p className="text-muted-foreground text-sm">No items soft-blocked</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
