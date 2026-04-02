import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { ArrowRight, Bot, Camera, Palette } from 'lucide-react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { HomePageWrapper } from '@/components/HomePageWrapper';
import HeroBackgroundImage from '@/components/HeroBackgroundImage';
import { RippleFillButton } from '@/components/ui/ripple-fill-button';

const GradientText = dynamic(() => import('@/components/GradientText'), { ssr: false });
const TextType = dynamic(() => import('@/components/TextType'), { ssr: false });
const TrueFocus = dynamic(() => import('@/components/TrueFocus'), {
  ssr: false,
  loading: () => <span className="text-3xl md:text-4xl font-headline font-bold text-white">What is SmartStyle?</span>,
});
const FooterText = dynamic(() => import('@/components/FooterText'), { ssr: false });
const BlurText = dynamic(() => import('@/components/BlurText'), {
  ssr: false,
  loading: () => null,
});
const InspirationCarouselTilt = dynamic(
  () => import('@/components/InspirationCarouselTilt').then((mod) => ({ default: mod.InspirationCarouselTilt })),
  { ssr: false }
);

export default function Home() {
  return (
    <HomePageWrapper>
      <div className="flex min-h-screen flex-col bg-[#050813] text-white">
        <section className="flex-grow">
          <section className="relative isolate flex h-[80vh] min-h-[420px] items-center justify-center overflow-hidden text-center sm:min-h-[540px] md:min-h-[640px]">
            <HeroBackgroundImage />
            <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

            <div className="relative z-30 mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 animate-fade-in-up">
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-headline font-extrabold tracking-tight text-foreground">
                Elevate Your Style with{' '}
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">AI</span>
              </h1>
              <p className="mt-6 text-lg text-slate-200/84 max-w-3xl mx-auto">
                Your personal AI stylist is here. Snap a photo of your outfit and get instant, intelligent feedback and visual recommendations.
              </p>
              <div className="mt-12">
                <RippleFillButton asChild>
                  <Link href="/style-check">
                    Upload Your Outfit
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                  </Link>
                </RippleFillButton>
              </div>
            </div>
          </section>

          <section className="content-auto relative overflow-hidden py-16 sm:py-20 md:py-24 border-t border-white/8">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(124,58,237,0.18),transparent_42%),radial-gradient(circle_at_78%_88%,rgba(192,132,252,0.14),transparent_40%),linear-gradient(to_bottom,rgba(10,10,20,0.98),rgba(8,7,18,0.97))]" />
            <div className="relative container mx-auto px-4 text-center sm:px-6 lg:px-8">
              <Card className="mx-auto w-full max-w-5xl border border-white/12 bg-white/[0.04] p-6 sm:p-8 md:p-10 backdrop-blur-2xl shadow-[0_18px_64px_rgba(76,29,149,0.24)] transition-all duration-300 hover:border-white/20">
                <h2 className="mb-5 text-3xl font-headline font-semibold tracking-[-0.02em] text-white md:text-4xl">
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
                  text={[
                    "SmartStyle is a cutting-edge application that leverages artificial intelligence to serve as your personal fashion consultant. By analyzing your outfits, considering the occasion, and even checking the weather, SmartStyle provides you with tailored recommendations to ensure you always look your best. It's more than just advice; it's visual inspiration.",
                  ]}
                  typingSpeed={20}
                  pauseDuration={10000}
                  showCursor={true}
                  cursorCharacter="|"
                  className="mx-auto max-w-4xl text-base sm:text-lg leading-relaxed text-slate-200/78"
                  loop={false}
                />
              </Card>
            </div>
          </section>

          <section className="content-auto relative overflow-hidden py-16 sm:py-20 md:py-24 border-y border-white/8">
            <div className="absolute inset-0 bg-[linear-gradient(140deg,rgba(56,24,110,0.22),rgba(10,12,28,0.98)_45%,rgba(76,29,149,0.28))]" />
            <div className="relative container mx-auto px-4 sm:px-6 lg:px-8">
              <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-2 md:gap-14">
                <div className="relative h-64 w-full overflow-hidden rounded-2xl border border-white/12 shadow-[0_22px_70px_rgba(30,10,70,0.5)] sm:h-80 md:h-[420px]">
                  <Image
                    src="https://images.pexels.com/photos/8306370/pexels-photo-8306370.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2"
                    alt="Fashion model silhouette"
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    style={{ objectFit: 'cover' }}
                    data-ai-hint="fashion model"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/25" />
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 md:p-8 backdrop-blur-xl shadow-[0_14px_40px_rgba(18,10,40,0.28)]">
                  <h2 className="mb-8 font-headline text-3xl md:text-4xl font-semibold tracking-[-0.02em] text-white">
                    From Upload to Upgrade
                  </h2>
                  <ul className="space-y-7 text-lg">
                    <li className="flex items-start gap-4">
                      <div className="rounded-xl border border-purple-400/30 bg-gradient-to-br from-purple-500/24 to-transparent p-3 text-purple-200 shadow-[0_10px_28px_rgba(147,51,234,0.28)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_14px_32px_rgba(147,51,234,0.4)]">
                        <Camera />
                      </div>
                      <div>
                        <BlurText
                          text="1. Snap & Upload"
                          delay={150}
                          animateBy="words"
                          direction="top"
                          className="text-xl font-semibold text-white"
                        />
                        <BlurText
                          text="Start by uploading a clear photo of your outfit."
                          delay={150}
                          animateBy="words"
                          direction="top"
                          className="text-slate-200/74"
                        />
                      </div>
                    </li>
                    <li className="flex items-start gap-4">
                      <div className="rounded-xl border border-purple-400/30 bg-gradient-to-br from-purple-500/24 to-transparent p-3 text-purple-200 shadow-[0_10px_28px_rgba(147,51,234,0.28)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_14px_32px_rgba(147,51,234,0.4)]">
                        <Bot />
                      </div>
                      <div>
                        <BlurText
                          text="2. AI Analysis"
                          delay={150}
                          animateBy="words"
                          direction="top"
                          className="text-xl font-semibold text-white"
                        />
                        <BlurText
                          text="Our AI analyzes colors, patterns, and style in seconds."
                          delay={150}
                          animateBy="words"
                          direction="top"
                          className="text-slate-200/74"
                        />
                      </div>
                    </li>
                    <li className="flex items-start gap-4">
                      <div className="rounded-xl border border-purple-400/30 bg-gradient-to-br from-purple-500/24 to-transparent p-3 text-purple-200 shadow-[0_10px_28px_rgba(147,51,234,0.28)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_14px_32px_rgba(147,51,234,0.4)]">
                        <Palette />
                      </div>
                      <div>
                        <BlurText
                          text="3. Get Style Advice"
                          delay={150}
                          animateBy="words"
                          direction="top"
                          className="text-xl font-semibold text-white"
                        />
                        <BlurText
                          text="Receive personalized feedback and visual suggestions."
                          delay={150}
                          animateBy="words"
                          direction="top"
                          className="text-slate-200/74"
                        />
                      </div>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          <InspirationCarouselTilt />

          <section className="content-auto relative py-16 sm:py-20 md:py-24 text-center text-white">
            <Image
              src="https://images.pexels.com/photos/322207/pexels-photo-322207.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2"
              alt="Stylish accessories flat lay"
              fill
              sizes="100vw"
              style={{ objectFit: 'cover' }}
              className="-z-10"
              data-ai-hint="fashion accessories"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/72 via-black/62 to-black/80" />
            <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8">
              <GradientText
                colors={['#e9d5ff', '#a855f7', '#c4b5fd']}
                animationSpeed={4}
                showBorder={false}
                className="text-3xl sm:text-4xl md:text-5xl font-headline font-semibold tracking-[-0.02em]"
              >
                Ready to upgrade your style?
              </GradientText>
              <FooterText />
              <div className="mt-8">
                <RippleFillButton asChild>
                  <Link href="/style-check">
                    Try SmartStyle Now
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                  </Link>
                </RippleFillButton>
              </div>
            </div>
          </section>
        </section>
      </div>
    </HomePageWrapper>
  );
}
