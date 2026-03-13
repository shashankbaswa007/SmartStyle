import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowRight, Bot, Camera, Palette } from 'lucide-react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { HomePageWrapper } from '@/components/HomePageWrapper';

// Lazy load heavy client-side animation components to reduce initial bundle
const GradientText = dynamic(() => import('@/components/GradientText'), { ssr: false });
const TextType = dynamic(() => import('@/components/TextType'), { ssr: false });
const TrueFocus = dynamic(() => import('@/components/TrueFocus'), { ssr: false,
  loading: () => <span className="text-3xl md:text-4xl font-headline font-bold">What is SmartStyle?</span>
});
const FooterText = dynamic(() => import('@/components/FooterText'), { ssr: false });
const BlurText = dynamic(() => import('@/components/BlurText'), { ssr: false,
  loading: () => null
});
const InspirationCarouselTilt = dynamic(
  () => import('@/components/InspirationCarouselTilt').then(mod => ({ default: mod.InspirationCarouselTilt })),
  { ssr: false }
);

export default function Home() {
  return (
    <HomePageWrapper>
    <div className="flex flex-col min-h-screen">
      <section className="flex-grow">
        {/* 1. Hero Section */}
        <section className="relative h-[80vh] min-h-[400px] sm:min-h-[500px] md:min-h-[600px] flex items-center justify-center text-center">
          <Image
            src="https://images.pexels.com/photos/934069/pexels-photo-934069.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2"
            alt="Fashion flat lay background"
            data-ai-hint="fashion flat lay"
            fill
            sizes="100vw"
            style={{ objectFit: 'cover' }}
            className="-z-10"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent"></div>

          {/* Content */}
          <div className="relative z-10 p-4 animate-fade-in-up">
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-headline font-extrabold tracking-tight text-foreground">
              Elevate Your Style with{" "}
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
                AI
              </span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-3xl mx-auto">
              Your personal AI stylist is here. Snap a photo of your outfit and get
              instant, intelligent feedback and visual recommendations.
            </p>
            <div className="mt-12">
              <Button
                  asChild
                  size="lg"
                  className="text-lg font-bold bg-gradient-to-r from-accent to-primary text-primary-foreground hover:shadow-lg hover:shadow-accent/30"
                >
                <Link href="/style-check">
                  Upload Your Outfit <ArrowRight className="ml-2" />
                </Link>
                </Button>
            </div>
          </div>
        </section>

        {/* 2. About SmartStyle Section */}
        <section className="content-auto py-10 sm:py-14 md:py-20 bg-gradient-to-br from-primary/20 via-background to-accent/20">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <Card className="max-w-4xl mx-auto bg-card/60 dark:bg-card/40 backdrop-blur-xl border-border/20 shadow-lg p-4 sm:p-6 md:p-8">
              <h2 className="text-3xl md:text-4xl font-headline font-bold mb-4">
              <TrueFocus 
                sentence="What is SmartStyle?"
                manualMode={false}
                blurAmount={5}
                borderColor="violet"
                animationDuration={0.5}
                pauseBetweenAnimations={0.5}
                />
              </h2>
              <TextType
                text={["SmartStyle is a cutting-edge application that leverages artificial intelligence to serve as your personal fashion consultant. By analyzing your outfits, considering the occasion, and even checking the weather, SmartStyle provides you with tailored recommendations to ensure you always look your best. It's more than just advice; it's visual inspiration."]}
                typingSpeed={20}
                pauseDuration={10000}
                showCursor={true}
                cursorCharacter="|"
                className="text-muted-foreground text-lg"
                loop={false}
              />
            </Card>
          </div>
        </section>

        {/* 4. AI Style in Action Section */}
        <section className="content-auto py-10 sm:py-14 md:py-20 bg-gradient-to-br from-violet-200/20 via-background to-purple-900/20">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 md:gap-12 items-center">
              <div className="relative w-full h-48 sm:h-64 md:h-96 rounded-lg overflow-hidden shadow-2xl">
                <Image src="https://images.pexels.com/photos/8306370/pexels-photo-8306370.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2" alt="Fashion model silhouette" fill sizes="(max-width: 768px) 100vw, 50vw" style={{ objectFit: 'cover' }} data-ai-hint="fashion model" />
              </div>
              <div>
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-headline font-bold mb-6">From Upload to Upgrade</h2>
                <ul className="space-y-6 text-lg">
                  <li className="flex items-start gap-4">
                    <div className="p-3 bg-violet-700/20 text-violet-400 rounded-full transition-all duration-300 hover:bg-violet-700/30 hover:shadow-lg hover:shadow-violet-700/20"><Camera /></div>
                    <div>
                      <BlurText
                        text="1. Snap & Upload"
                        delay={150}
                        animateBy="words"
                        direction="top"
                        className="font-bold text-xl"
                      />
                      <BlurText
                        text="Start by uploading a clear photo of your outfit."
                        delay={150}
                        animateBy="words"
                        direction="top"
                        className="text-muted-foreground"
                      />
                    </div>
                  </li>
                  <li className="flex items-start gap-4">
                    <div className="p-3 bg-violet-700/20 text-violet-400 rounded-full transition-all duration-300 hover:bg-violet-700/30 hover:shadow-lg hover:shadow-violet-700/20"><Bot /></div>
                    <div>
                      <BlurText
                        text="2. AI Analysis"
                        delay={150}
                        animateBy="words"
                        direction="top"
                        className="font-bold text-xl"
                      />
                      <BlurText
                        text="Our AI analyzes colors, patterns, and style in seconds."
                        delay={150}
                        animateBy="words"
                        direction="top"
                        className="text-muted-foreground"
                      />
                    </div>
                  </li>
                  <li className="flex items-start gap-4">
                    <div className="p-3 bg-violet-700/20 text-violet-400 rounded-full transition-all duration-300 hover:bg-violet-700/30 hover:shadow-lg hover:shadow-violet-700/20"><Palette /></div>
                    <div>
                      <BlurText
                        text="3. Get Style Advice"
                        delay={150}
                        animateBy="words"
                        direction="top"
                        className="font-bold text-xl"
                      />
                      <BlurText
                        text="Receive personalized feedback and visual suggestions."
                        delay={150}
                        animateBy="words"
                        direction="top"
                        className="text-muted-foreground"
                      />
                    </div>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* 5. Inspiration Gallery Section */}
        <InspirationCarouselTilt />

        {/* 6. Call-to-Action Footer Section */}
        <section className="content-auto relative py-10 sm:py-14 md:py-20 text-center text-white">
          <Image
            src="https://images.pexels.com/photos/322207/pexels-photo-322207.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2"
            alt="Stylish accessories flat lay"
            fill
            sizes="100vw"
            style={{ objectFit: 'cover' }}
            className="-z-10"
            data-ai-hint="fashion accessories"
          />
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8">
            <GradientText
              colors={["#A78BFA", "#7B68EE", "#A78BFA"]}
              animationSpeed={4}
              showBorder={false}
              className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-headline font-bold"
            >
              Ready to upgrade your style?
            </GradientText>
            <FooterText />
            <div className="mt-8">
              <Button asChild size="lg" className="text-lg font-bold bg-gradient-to-r from-accent to-primary text-primary-foreground hover:shadow-lg hover:shadow-accent/30">
                <Link href="/style-check">
                  Try SmartStyle Now ✨
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </section>
    </div>
    </HomePageWrapper>
  );
}
