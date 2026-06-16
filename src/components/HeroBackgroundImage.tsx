import * as React from 'react';


export default function HeroBackgroundImage() {
  return (
    <video
      autoPlay
      loop
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
