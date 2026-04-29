'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';

export default function HeroBackgroundImage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [useImage, setUseImage] = useState(false);

  useEffect(() => {
    // Fallback to image for reduced-motion or small screens
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isSmallScreen = window.innerWidth < 768;

    if (prefersReduced || isSmallScreen) {
      setUseImage(true);
      return;
    }

    // Set cinematic playback rate
    if (videoRef.current) {
      videoRef.current.playbackRate = 0.9;
    }
  }, []);

  if (useImage) {
    return (
      <Image
        src="/images/hero-934069.jpg"
        alt="Fashion flat lay background"
        fill
        sizes="100vw"
        priority
        quality={90}
        style={{ objectFit: 'cover' }}
        className="z-0"
      />
    );
  }

  return (
    <video
      ref={videoRef}
      src="/hero-loop.mp4"
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
      poster="/images/hero-934069.jpg"
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        zIndex: 0,
      }}
    />
  );
}
