import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { ArrowRight, Bot, Eye, Palette, Sparkles } from 'lucide-react';
import Image from 'next/image';

export default function Home() {
  const galleryItems = [
    { src: "https://images.pexels.com/photos/1926769/pexels-photo-1926769.jpeg?auto=compress&cs=tinysrgb&w=600", alt: "Stylish urban outfit", hint: "urban fashion" },
    { src: "https://images.pexels.com/photos/983569/pexels-photo-983569.jpeg?auto=compress&cs=tinysrgb&w=600", alt: "Elegant evening wear", hint: "elegant dress" },
    { src: "https://images.pexels.com/photos/1043474/pexels-photo-1043474.jpeg?auto=compress&cs=tinysrgb&w=600", alt: "Casual summer look", hint: "summer casual" },
    { src: "https://images.pexels.com/photos/298863/pexels-photo-298863.jpeg?auto=compress&cs=tinysrgb&w=600", alt: "Professional work attire", hint: "work attire" },
    { src: "https://images.pexels.com/photos/1040945/pexels-photo-1040945.jpeg?auto=compress&cs=tinysrgb&w=600", alt: "Vibrant party dress", hint: "party fashion" },
  ];

  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-grow">
        {/* 1. Hero Section */}
        <section className="relative h-[80vh] min-h-[600px] flex items-center justify-center text-center">
      <Image
        src="https://images.pexels.com/photos/934069/pexels-photo-934069.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2"
        alt="Fashion flat lay background"
        data-ai-hint="fashion flat lay"
        fill
        className="object-cover -z-10"
        priority
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent"></div>

      {/* Content */}
      <div className="relative z-10 p-4 animate-fade-in-up">
        <h1 className="text-5xl md:text-7xl font-headline font-extrabold tracking-tight text-foreground">
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
          <Link href="/style-check">
            <Button
              size="lg"
              className="text-lg font-bold bg-gradient-to-r from-accent to-primary text-primary-foreground hover:shadow-lg hover:shadow-accent/30 transition-all duration-300 transform hover:scale-105"
            >
              Upload Your Outfit <ArrowRight className="ml-2" />
            </Button>
          </Link>
        </div>
      </div>
    </section>

        {/* 2. About SmartStyle Section */}
        <section className="py-20 bg-gradient-to-br from-primary/20 via-background to-accent/20">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
                <Card className="max-w-4xl mx-auto bg-card/60 dark:bg-card/40 backdrop-blur-xl border-border/20 shadow-lg p-8">
                    <h2 className="text-3xl md:text-4xl font-headline font-bold mb-4">What is SmartStyle?</h2>
                    <p className="text-muted-foreground text-lg">
                        SmartStyle is a cutting-edge application that leverages artificial intelligence to serve as your personal fashion consultant. By analyzing your outfits, considering the occasion, and even checking the weather, SmartStyle provides you with tailored recommendations to ensure you always look your best. It's more than just advice; it's visual inspiration.
                    </p>
                </Card>
            </div>
        </section>

        {/* 4. AI Style in Action Section */}
         <section className="py-20 bg-primary/20">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                    <div className="relative w-full h-96 rounded-lg overflow-hidden shadow-2xl">
                        <Image src="https://images.pexels.com/photos/8306370/pexels-photo-8306370.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2" alt="Fashion model silhouette" layout="fill" objectFit="cover" data-ai-hint="fashion model" />
                    </div>
                    <div>
                        <h2 className="text-4xl font-headline font-bold mb-6">From Upload to Upgrade</h2>
                        <ul className="space-y-6 text-lg">
                            <li className="flex items-start gap-4">
                                <div className="p-3 bg-accent/20 text-accent rounded-full"><Eye /></div>
                                <div>
                                    <h3 className="font-bold text-xl">1. Snap & Upload</h3>
                                    <p className="text-muted-foreground">Start by uploading a clear photo of your outfit.</p>
                                </div>
                            </li>
                            <li className="flex items-start gap-4">
                                <div className="p-3 bg-accent/20 text-accent rounded-full"><Bot /></div>
                                <div>
                                    <h3 className="font-bold text-xl">2. AI Analysis</h3>
                                    <p className="text-muted-foreground">Our AI analyzes colors, patterns, and style in seconds.</p>
                                </div>
                            </li>
                             <li className="flex items-start gap-4">
                                <div className="p-3 bg-accent/20 text-accent rounded-full"><Palette /></div>
                                <div>
                                    <h3 className="font-bold text-xl">3. Get Style Advice</h3>
                                    <p className="text-muted-foreground">Receive personalized feedback and visual suggestions.</p>
                                </div>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </section>
        
        {/* 5. Inspiration Gallery Section */}
        <section className="py-20">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-4xl font-headline font-bold text-center mb-12">Find Your Inspiration</h2>
            <Carousel opts={{ loop: true }} className="w-full max-w-5xl mx-auto">
              <CarouselContent>
                {galleryItems.map((item, index) => (
                  <CarouselItem key={index} className="md:basis-1/2 lg:basis-1/3">
                    <div className="p-1">
                      <Card className="overflow-hidden group">
                        <CardContent className="p-0 aspect-[3/4] relative">
                          <Image src={item.src} alt={item.alt} fill className="object-cover transition-transform duration-300 group-hover:scale-105" data-ai-hint={item.hint} />
                        </CardContent>
                      </Card>
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious className="ml-12" />
              <CarouselNext className="mr-12" />
            </Carousel>
          </div>
        </section>

        {/* 6. Call-to-Action Footer Section */}
        <section className="relative py-20 text-center text-white">
          <Image
            src="https://images.pexels.com/photos/322207/pexels-photo-322207.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2"
            alt="Stylish accessories flat lay"
            fill
            className="object-cover -z-10"
            data-ai-hint="fashion accessories"
          />
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-4xl md:text-5xl font-headline font-bold">Ready to upgrade your style?</h2>
            <p className="mt-4 text-lg max-w-2xl mx-auto">
              Let our AI be your guide to a more confident and stylish you. Get started for free.
            </p>
            <div className="mt-8">
              <Link href="/style-check">
                <Button size="lg" className="text-lg font-bold bg-gradient-to-r from-accent to-primary text-primary-foreground hover:shadow-lg hover:shadow-accent/30 transition-all duration-300 transform hover:scale-105">
                  Try SmartStyle Now ✨
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
