import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { InteractiveBackground } from '@/components/interactive-background';
import { Eye, Bot, Sparkles } from 'lucide-react';

export default function Home() {
  const features = [
    {
      icon: <Eye className="w-8 h-8 text-accent" />,
      title: "Visual Outfit Analysis",
      description: "Upload an image of your outfit and our AI will instantly analyze your look, identifying colors, styles, and items."
    },
    {
      icon: <Bot className="w-8 h-8 text-accent" />,
      title: "AI-Powered Feedback",
      description: "Receive personalized and constructive feedback based on your outfit, occasion, and even the local weather."
    },
    {
      icon: <Sparkles className="w-8 h-8 text-accent" />,
      title: "Visual Recommendations",
      description: "Don't just read suggestions. See them. Our AI generates images of recommended outfits to inspire you."
    }
  ];

  return (
    <div className="relative overflow-hidden">
      <InteractiveBackground />
      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32 text-center">
        <div className="animate-fade-in-up">
          <h1 className="text-5xl md:text-7xl font-headline font-extrabold text-foreground tracking-tight">
            Elevate Your Style with <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">AI</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-3xl mx-auto">
            SmartStyle is your personal AI stylist. Snap a photo of your outfit and get instant, intelligent feedback and visual recommendations to perfect your look for any occasion.
          </p>
          <div className="mt-12">
            <Link href="/style-check">
              <Button size="lg" className="text-lg font-bold bg-gradient-to-r from-primary to-accent text-white hover:shadow-lg hover:shadow-primary/30 transition-all duration-300 transform hover:scale-105">
                Wanna check your fit? ;)
              </Button>
            </Link>
          </div>
        </div>

        <div className="mt-24 md:mt-32">
          <h2 className="text-4xl font-headline font-bold text-center mb-12 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="animate-fade-in-up" style={{ animationDelay: `${0.4 + index * 0.2}s` }}>
                <Card className="h-full bg-card/60 dark:bg-card/40 backdrop-blur-xl border-border/20 shadow-lg hover:shadow-primary/20 hover:-translate-y-2 transition-transform duration-300">
                  <CardHeader className="items-center">
                    <div className="p-4 bg-primary/10 rounded-full mb-4">
                      {feature.icon}
                    </div>
                    <CardTitle className="font-headline text-2xl">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-center text-muted-foreground">
                    {feature.description}
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
