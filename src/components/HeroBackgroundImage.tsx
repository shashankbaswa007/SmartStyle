'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';

type ConnectionType = '4g' | '3g' | '2g' | '1xrtt' | 'slow-2g' | undefined;

export default function HeroBackgroundImage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [useImage, setUseImage] = useState(false);
  const [videoSrc, setVideoSrc] = useState('/hero-loop.mp4');
  const [supportsWebM, setSupportsWebM] = useState(true);

  useEffect(() => {
    // Check for reduced-motion preference
    const prefersReduced = window.matchMedia('(prefers-reduce-motion: reduce)').matches;
    if (prefersReduced) {
      setUseImage(true);
      return;
    }

    // Detect effective connection type and screen size
    const connection = (navigator as any).connection;
    const effectiveType: ConnectionType = connection?.effectiveType;
    const isSmallScreen = window.innerWidth < 768;
    const isMobile = window.innerHeight < 1024;

    // Determine video source based on bandwidth
    let selectedSrc = '/hero-loop.mp4';

    if (effectiveType === '2g' || effectiveType === 'slow-2g' || effectiveType === '1xrtt') {
      // Slow connections: use image fallback
      setUseImage(true);
      return;
    } else if (effectiveType === '3g' || (isSmallScreen && effectiveType !== '4g')) {
      // Mobile/3G: use compressed H.264
      selectedSrc = '/hero-loop-mobile.mp4';
    }
    // 4g/5g or unknown: use full-quality desktop version

    setVideoSrc(selectedSrc);

    // Check browser support for WebM
    const video = document.createElement('video');
    const webmSupport = video.canPlayType('video/webm; codecs="vp9"') !== '';
    setSupportsWebM(webmSupport);

    // Set cinematic playback rate if video element is available
    if (videoRef.current) {
      videoRef.current.playbackRate = 0.9;
      
      // Handle video loading errors
      videoRef.current.addEventListener('error', () => {
        console.warn('Video failed to load, falling back to image');
        setUseImage(true);
      });
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
    >
      {supportsWebM && <source src="/hero-loop.webm" type="video/webm" />}
      <source src={videoSrc} type="video/mp4" />
      <Image
        src="/images/hero-934069.jpg"
        alt="Fashion flat lay background"
        fill
        sizes="100vw"
        quality={90}
        style={{ objectFit: 'cover' }}
      />
    </video>
  );
}
