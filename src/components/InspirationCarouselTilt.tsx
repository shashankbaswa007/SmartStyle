
'use client';

import Tilt from 'react-parallax-tilt';
import { Card, CardContent } from '@/components/ui/card';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import Image from 'next/image';

const galleryItems = [
    { src: "https://images.pexels.com/photos/1926769/pexels-photo-1926769.jpeg?auto=compress&cs=tinysrgb&w=600", alt: "Stylish urban outfit", hint: "Chic Streetwear Vibes" },
    { src: "https://images.pexels.com/photos/983569/pexels-photo-983569.jpeg?auto=compress&cs=tinysrgb&w=600", alt: "Elegant evening wear", hint: "Timeless Evening Glam" },
    { src: "https://images.pexels.com/photos/1043474/pexels-photo-1043474.jpeg?auto=compress&cs=tinysrgb&w=600", alt: "Casual summer look", hint: "Sunny Day Essentials" },
    { src: "https://images.pexels.com/photos/298863/pexels-photo-298863.jpeg?auto=compress&cs=tinysrgb&w=600", alt: "Professional work attire", hint: "Modern Office Mode" },
    { src: "https://images.pexels.com/photos/1040945/pexels-photo-1040945.jpeg?auto=compress&cs=tinysrgb&w=600", alt: "Vibrant party dress", hint: "After-Hours Sparkle" },
];

export function InspirationCarouselTilt() {
  return (
    <section className="py-20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-4xl font-headline font-bold text-center mb-12">Find Your Inspiration</h2>
        <Carousel opts={{ loop: true }} className="w-full max-w-5xl mx-auto">
          <CarouselContent>
            {galleryItems.map((item, index) => (
              <CarouselItem key={index} className="md:basis-1/2 lg:basis-1/3">
                <div className="p-1">
                  <Tilt
                    tiltMaxAngleX={20}
                    tiltMaxAngleY={20}
                    perspective={1000}
                    glareEnable={true}
                    glareMaxOpacity={0.5}
                    transitionSpeed={2500}
                    scale={1.05}
                    className="w-full h-full rounded-lg"
                  >
                    <Card className="overflow-hidden group w-full h-full">
                      <CardContent className="p-0 aspect-[3/4] relative">
                        <Image
                          src={item.src}
                          alt={item.alt}
                          fill
                          style={{ objectFit: 'cover' }}
                          className="transition-transform duration-300 group-hover:scale-105"
                          data-ai-hint={item.hint}
                        />
                        <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                          <p className="text-white text-lg font-bold">{item.hint}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </Tilt>
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="ml-12" />
          <CarouselNext className="mr-12" />
        </Carousel>
      </div>
    </section>
  );
}
