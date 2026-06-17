"use client";

import React, { useRef, useEffect } from 'react';

export default function HeroBackgroundImage() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let isReversing = false;
    let animationFrameId: number;
    let lastTimestamp: number = 0;

    const reversePlay = (timestamp: number) => {
      if (!isReversing) return;

      if (!lastTimestamp) lastTimestamp = timestamp;
      const delta = (timestamp - lastTimestamp) / 1000;
      lastTimestamp = timestamp;

      // When we reach the beginning, resume normal playback
      if (video.currentTime <= 0.05) {
        isReversing = false;
        video.currentTime = 0;
        video.play().catch((e) => console.error("Playback failed:", e));
        return;
      }

      // Step back current time, clamp delta to avoid huge jumps on tab switch
      const clampedDelta = Math.min(delta, 0.1);
      video.currentTime = Math.max(0, video.currentTime - clampedDelta);
      
      animationFrameId = requestAnimationFrame(reversePlay);
    };

    const handleTimeUpdate = () => {
      // Trigger reverse when nearing the end
      if (!isReversing && video.duration && video.currentTime >= video.duration - 0.05) {
        video.pause();
        isReversing = true;
        lastTimestamp = 0; // Reset timestamp for reverse play
        animationFrameId = requestAnimationFrame(reversePlay);
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, []);

  return (
    <video
      ref={videoRef}
      autoPlay
      muted
      playsInline
      preload="auto"
      poster="/images/hero-934069.jpg"
      style={{ objectFit: 'cover' }}
      className="absolute inset-0 z-0 h-full w-full object-cover"
    >
      <source src="/hero-compressed.mp4" type="video/mp4" />
      <img
        src="/images/hero-934069.jpg"
        alt="Fashion flat lay background"
        style={{ objectFit: 'cover' }}
        className="absolute inset-0 z-0 h-full w-full object-cover"
      />
    </video>
  );
}
